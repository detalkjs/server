const express = require('express')
const app = express();
const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base('detalk');
const { getComment } = require('./src/getComment');
const md5 = require("js-md5");
const marked = require("marked");
const sanitizeHtml = require('sanitize-html');
const version = require("package.json").version;
const { generate } = require("./src/generate");

function textconvert(text) {
    text = text.replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});
    text = text.replace(/\r?\n/g," ");
    text = text.replace(/((\s|&nbsp;)*\r?\n){1,}/g,"\r\n\r\n");
    text = text.replace(/^((\s|&nbsp;)*\r?\n)+/g,'');
    text = text.replace(/((\s|&nbsp;)*\r?\n)+$/g,'');
    return text;
}

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization,X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method' );
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE');
    res.header('Allow', 'GET, POST, PATCH, OPTIONS, PUT, DELETE');
    res.header('Content-Type', 'application/json');
    next();
});

app.get('/', (req, res) => {
    res.send(JSON.stringify({
        version,
        message: "Detalk Server is running.",
        timestamp: Date.now(),
    }));
});

/**
 * Get Comments
 */
app.get('/_api/comment', async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let id = obj.searchParams.get("id") || "/";
    let resp = await getComment("CMT_" + id) || {key: "CMT_" + id, value: []};
    if (resp.value.length > 0) {
        for (let i in resp.value) {
            resp.value[i].auth = "";
            if (resp.value[i].replies) {
                for (let j in resp.value[i].replies) {
                    resp.value[i].replies[j].auth = "";
                }
            }
        }
    }
    res.send(resp);
});

app.put('/_api/comment', async (req, res) => {
    req.on('data', async function(ck) {
        try {
            const rqb = JSON.parse(ck.toString());
            let { nickname, email, content, replyTo, url, id, auth } = rqb;
            if (!nickname || !email || !content || !id) throw "Nickname, email, id or content is empty.";
            if (nickname.length >= 15 || content.length >= 500 || email.length >= 50 || url.length >= 100) throw "Nickname, email, url or content is too long.";
            url = url || "";
            nickname = textconvert(nickname);
            content = sanitizeHtml(marked.parse(content));
            const fetchKey = "CMT_"+id;
            let bflist = await getComment(fetchKey) || {};
            bflist = bflist.value;
            if (!bflist) { bflist = []; }
            if (!replyTo) {
                // 独立评论
                bflist.push({
                    nickname,
                    email,
                    content,
                    url,
                    timestamp: Date.now(),
                    ip: req.headers['X-Real-Ip'],
                    ua: req.headers['user-agent'],
                    rpid: md5(Date.now() + nickname + email + content),
                    auth,
                });
                let dbr = await db.put(bflist, fetchKey);
                if (dbr) {
                    res.send(JSON.stringify({
                        success: true,
                        message: "Comment sended.",
                    }));
                } else {
                    throw "Failed to put comment.";
                }
            } else {
                // 回复评论
                let ok = false;
                for (let i of bflist) {
                    if (i.rpid == replyTo) {
                        ok = true;
                        i.replies = i.replies || [];
                        i.replies.push({
                            nickname,
                            email,
                            content,
                            url,
                            ip: req.headers['X-Real-Ip'],
                            ua: req.headers['user-agent'],
                            timestamp: Date.now(),
                            rpid: md5(Date.now() + nickname + email + content),
                            auth,
                        });
                        let dbr = await db.put(bflist, fetchKey);
                        if (dbr) {
                            res.send(JSON.stringify({
                                success: true,
                                message: "Comment sended.",
                            }));
                        } else {
                            throw "Failed to put comment.";
                        }
                        break;
                    }
                }
                if (!ok) throw "Comment is not found.";
            }
        } catch (e) {
            console.warn(e);
            res.send(JSON.stringify({
                success: false,
                error: e,
            }));
        }
    });
});

app.delete("/_api/comment", async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let id = "CMT_" + obj.searchParams.get("id") || "/";
    let rpid = obj.searchParams.get("rpid") || "";
    let auth = obj.searchParams.get("auth") || "";
    // 删除评论
    try {
        let bflist = (await getComment(id)).value || [];
        let ok = false;
        for (let o in bflist) {
            console.log(bflist[o].rpid, rpid);
            if (bflist[o].rpid == rpid && bflist[o].auth == auth) {
                // Catch ID
                ok = true;
                bflist[o] = { deleted: true };
                let dbr = await db.put(bflist, id);
                if (dbr) {
                    res.send(JSON.stringify({
                        success: true,
                        message: "Comment deleted.",
                    }));
                } else {
                    throw "Failed to delete comment.";
                }
                break;
            }
            if (bflist[o].replies) {
                for (let j in bflist[o].replies) {
                    console.log(bflist[o].replies[j].rpid, rpid);
                    if (rpid == bflist[o].replies[j].rpid && bflist[o].replies[j].auth == auth) {
                        ok = true;
                        bflist[o].replies[j] = { deleted: true };
                        let dbr = await db.put(bflist, id);
                        if (dbr) {
                            res.send(JSON.stringify({
                                success: true,
                                message: "Comment deleted.",
                            }));
                        } else {
                            throw "Failed to delete comment.";
                        }
                        break;
                    }
                }
            }
        }
        if (!ok) throw "Comment is not found.";
    } catch (e) {
        console.warn(e);
        res.send(JSON.stringify({
            success: false,
            error: e,
        }));
    }
});


app.get("/config", (req, res) => {
    res.header('Content-Type', 'text/html');
    res.send(generate("config"));
})


module.exports = app;