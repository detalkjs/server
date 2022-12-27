const express = require('express')
const app = express();
const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base('detalk');
const { getComment } = require('./src/getComment');
const { checkToken } = require('./src/checkToken');
const md5 = require("js-md5");
const marked = require("marked");
const sanitizeHtml = require('sanitize-html');
const version = require("package.json").version;
const { generate } = require("./src/generate");
const { afterComment } = require("./src/action/afterComment");
const { beforeComment } = require("./src/action/beforeComment");
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
    let page = obj.searchParams.get("pageid") || "0";
    let pageSize = obj.searchParams.get("pagesize") || "1";
    let all = obj.searchParams.get("all") || false;
    // 时间正序
    let timeFst = obj.searchParams.get("timefst") || false;
    timeFst = Boolean(timeFst);
    page = Number(page) || 0;
    
    let resp = await getComment("CMT_" + id) || {key: "CMT_" + id, value: []};

    let fromPage, toPage;
    if (!timeFst) {
        toPage = (page + 1) * (Number(pageSize) - 1);
        fromPage = page * (Number(pageSize) - 1);
    } else {
        fromPage = (resp.value.length - 1) - (page * Number(pageSize));
        toPage = fromPage - Number(pageSize);
    }
    console.log(fromPage, toPage);
    let rtData = [];
    if (fromPage == 0 || fromPage == resp.value.length -1) {
        try {
            let topi = JSON.parse(JSON.stringify(resp.value[resp.top]));
            topi.email = md5(topi.email);
            topi.auth = "";
            if (topi.replies) {
                for (let j in topi.replies) {
                    topi.replies[j].auth = "";
                    topi.replies[j].email = md5(topi.replies[j].email);
                }
            }
            rtData.push(topi);
        } catch(e) {console.warn(e)}
    }
    let hasNextPage = false;
    if (all) {
        for (let i in resp.value) {
            try {
                resp.value[i].auth = "";
                resp.value[i].email = md5(resp.value[i].email);
                if (resp.value[i].replies) {
                    for (let j in resp.value[i].replies) {
                        resp.value[i].replies[j].auth = "";
                        resp.value[i].replies[j].email = md5(resp.value[i].replies[j].email);
                    }
                }
            } catch(e) {}
        }
        res.send({
            value: resp.value,
            success: true,
            length: resp.value.length
        });
        return true;
    }
    if (resp.value.length > 0) {
        // resp.value
        console.log("ok");
        if (timeFst) {
            for (let i = fromPage; i > toPage; i--) {
                console.log(rtData);
                if (!resp.value[i]) {
                    hasNextPage = false;
                    break;
                }
                try {
                    resp.value[i].auth = "";
                    resp.value[i].email = md5(resp.value[i].email);
                    if (resp.value[i].replies) {
                        for (let j in resp.value[i].replies) {
                            resp.value[i].replies[j].auth = "";
                            resp.value[i].replies[j].email = md5(resp.value[i].replies[j].email);
                        }
                    }
                } catch(e) {}
                rtData.push(resp.value[i]);
            }
        } else {
            for (let i = fromPage; i < toPage; i++) {
                console.log(rtData);
                try {
                    resp.value[i].auth = "";
                    resp.value[i].email = md5(resp.value[i].email);
                    if (resp.value[i].replies) {
                        for (let j in resp.value[i].replies) {
                            resp.value[i].replies[j].auth = "";
                            resp.value[i].replies[j].email = md5(resp.value[i].replies[j].email);
                        }
                    }
                } catch(e) {}
                rtData.push(resp.value[i]);
            }
        }
        if (resp.value[toPage+1]) hasNextPage = true;
    }

    res.send({
        value: rtData,
        success: true,
        hasNextPage,
        length: resp.value.length
    });
});

app.put('/_api/comment', async (req, res) => {
    req.on('data', async function(ck) {
        try {
            const rqb = JSON.parse(ck.toString());
            let { nickname, email, content, replyTo, url, id, auth } = rqb;
            let label = null;
            if (checkToken(auth)) {
                if ((!nickname || !email || !url)) {
                    nickname = (await db.get("ADMIN_NICKNAME")).value;
                    email = (await db.get("ADMIN_EMAIL")).value;
                    url = (await db.get("ADMIN_LINK")).value;
                }
                label = "admin";
            }
            console.log(label);
            if (!nickname || !email || !content || !id) throw "Nickname, email, id or content is empty.";
            if (nickname.length >= 15 || content.length >= 500 || email.length >= 50 || url.length >= 100) throw "Nickname, email, url or content is too long.";
            url = textconvert(url) || "";
            nickname = textconvert(nickname);
            content = sanitizeHtml(marked.parse(content));
            const fetchKey = "CMT_"+id;
            let bflist = await getComment(fetchKey) || {};
            bflist = bflist.value;
            if (!bflist) { bflist = []; }
            if (!replyTo) {
                // 独立评论
                let rpid = md5(Date.now() + nickname + email + content);
                let data = {
                    nickname,
                    email,
                    content,
                    url,
                    timestamp: Date.now(),
                    ip: req.headers['X-Real-Ip'],
                    ua: req.headers['user-agent'],
                    rpid,
                    auth,
                    label,
                };
                data = await beforeComment(data);
                bflist.push(data);
                let dbr = await db.put({
                    ...await getComment(fetchKey),
                    value: bflist,
                }, fetchKey);
                if (dbr) {
                    afterComment(data);
                    res.send(JSON.stringify({
                        success: true,
                        message: "Comment sended.",
                        rpid,
                    }));
                } else {
                    throw "Failed to put comment.";
                }
            } else {
                // 回复评论
                let ok = false;
                for (let i of bflist) {
                    if (i.rpid == replyTo) {
                        let rpid = md5(Date.now() + nickname + email + content);
                        ok = true;
                        i.replies = i.replies || [];
                        let data = {
                            nickname,
                            email,
                            content,
                            url,
                            ip: req.headers['X-Real-Ip'],
                            ua: req.headers['user-agent'],
                            timestamp: Date.now(),
                            rpid,
                            auth,
                            label,
                        };
                        data = await beforeComment(data);
                        i.replies.push(data);
                        let dbr = await db.put({
                            ...await getComment(fetchKey),
                            value: bflist,
                        }, fetchKey);
                        if (dbr) {
                            afterComment(data);
                            res.send(JSON.stringify({
                                success: true,
                                message: "Comment sended.",
                                rpid,
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
    let hide = obj.searchParams.get("hide") || false;
    let unhide = obj.searchParams.get("unhide") || false;
    unhide = Boolean(unhide);
    hide = Boolean(hide);
    // 删除评论
    try {
        let bflist = (await getComment(id)).value || [];
        let ok = false;
        for (let o in bflist) {
            console.log(bflist[o].rpid, rpid);
            if (bflist[o].rpid == rpid) {
                if (bflist[o].auth != auth && !(await checkToken(auth))) throw "Unauthorized.";
                // Catch ID
                ok = true;
                if (!hide && !unhide) {
                    delete bflist[o];
                } else if (unhide) {
                    bflist[o].hide = false;
                } else {
                    bflist[o].hide = true;
                }
                let bfl = bflist.filter(function (s) {
                    if (s == null) {
                        return false;
                    } else {
                        return s;
                    }
                });
                let dbr = await db.put({
                    ...await getComment(fetchKey),
                    value: bfl,
                }, id);
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
                    if (rpid == bflist[o].replies[j].rpid) {
                        if (bflist[o].replies[j].auth != auth && !(await checkToken(auth))) throw "Unauthorized.";
                        ok = true;
                        if (!hide && !unhide) {
                            delete bflist[o].replies[j];
                        } else if (unhide) {
                            bflist[o].replies[j].hide = false;
                        } else {
                            bflist[o].replies[j].hide = true;
                        }
                        let bfl = bflist.filter(function (s) {
                            if (s == null) {
                                return false;
                            } else {
                                return s;
                            }
                        });
                        let dbr = await db.put({
                            ...await getComment(fetchKey),
                            value: bfl,
                        }, id);
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


// 登录
app.get("/_api/login", async (req, res) => {
    let username = (await db.get('DETALK_USERNAME')).value;
    let password = (await db.get('DETALK_PASSWORD')).value;
    let obj = new URL("http://0.0.0.0"+req.url);
    let p_username = obj.searchParams.get("username") || "";
    let p_password = obj.searchParams.get("password") || "";
    console.log(username, p_username)
    console.log(password, p_password)
    if (username == p_username && password == p_password) {
        let token = md5(new Date().getFullYear() + (new Date().getMonth() + 1) + username + password + "DETALK");
        res.send({
            success: true,
            token,
        });
    } else {
        res.send({
            success: false,
            error: "Invalid username or password.",
        });
    }
})

// 检查 Token 是否有效
app.get("/_api/token", async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let token = obj.searchParams.get("token") || "";
    if (await checkToken(token)) {
        res.send({
            success: true,
        });
    } else {
        res.send({
            success: false,
            error: "Invalid token.",
        });
    }
})

// 用户信息

app.get("/_api/profile", async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let token = obj.searchParams.get("token") || "";
    if (await checkToken(token)) {
        let nickname = (await db.get("ADMIN_NICKNAME")).value;
        let email = (await db.get("ADMIN_EMAIL")).value;
        let link = (await db.get("ADMIN_LINK")).value;
        res.send({
            success: true,
            nickname,
            email,
            link,
        });
    } else {
        res.send({
            success: false,
            error: "Invalid token.",
        });
    }
})

// 置顶
app.get("/_api/top", async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let token = obj.searchParams.get("token") || "";
    let pid = obj.searchParams.get("page") || "";
    let rpid = obj.searchParams.get("rpid") || "";
    pid = "CMT_" + pid;
    if (await checkToken(token)) {
        let resp = await getComment(pid);
        let top = -1;
        for (let i in resp.value) {
            if (resp.value[i].rpid == rpid) {
                top = i;
                break;
            }
        }
        if (top == -1) {
            res.send({
                success: false,
                error: "Comment not found.",
            });
            return false;
        }
        resp.top = top;
        resp.value[top].top = true;
        let dbr = await db.put(resp, pid);
        if (dbr) {
            res.send({
                success: true,
            });
        } else {
            res.send({
                success: false,
                error: "Failed.",
            });
        }
    } else {
        res.send({
            success: false,
            error: "Invalid token.",
        });
    }
})

// 取消置顶

app.delete("/_api/top", async (req, res) => {
    let obj = new URL("http://0.0.0.0"+req.url);
    let token = obj.searchParams.get("token") || "";
    let pid = obj.searchParams.get("page") || "";
    pid = "CMT_" + pid;
    if (await checkToken(token)) {
        let resp = await getComment(pid);
        let top = resp.top;
        resp.value[top].top = false;
        resp.top = null;
        let dbr = await db.put(resp, pid);
        if (dbr) {
            res.send({
                success: true,
            });
        } else {
            res.send({
                success: false,
                error: "Failed.",
            });
        }
    } else {
        res.send({
            success: false,
            error: "Invalid token.",
        });
    }
})

// 注册

app.get("/_api/reg", async (req, res) => {
    let username = (await db.get('DETALK_USERNAME')).value;
    let password = (await db.get('DETALK_PASSWORD')).value;
    if (username && password) {
        res.send({
            success: false,
            error: "Already registered.",
            reg: true,
        });
        return false;
    }
    let obj = new URL("http://0.0.0.0"+req.url);
    username = obj.searchParams.get("username") || "";
    password = obj.searchParams.get("password") || "";
    if (!username || !password || username.length > 15) {
        res.send({
            success: false,
            error: "Invalid username or password.",
            reg: false,
        });
        return false;
    }
    let usrdb = await db.put(username, 'DETALK_USERNAME');
    let pwddb = await db.put(password, 'DETALK_PASSWORD');
    if (usrdb && pwddb) {
        res.send({
            success: true,
            message: "Registered.",
            token: md5(new Date().getFullYear() + (new Date().getMonth() + 1) + username + password + "DETALK"),
        });
    } else {
        res.send({
            success: false,
            error: "Failed to register.",
        });
    }
})

app.get("/_api/all", async (req, res) => {
    try {
        let obj = new URL("http://0.0.0.0"+req.url);
        let token = obj.searchParams.get("token") || "";
        if (await checkToken(token)) {
            // let all = await db.fetch({
            //     "key?contains": "CMT_"
            // });
            let all = await db.fetch();
            let data = [];
            for (let i in all.items) {
                if (all.items[i].key.startsWith("CMT_")) {
                    data.push(all.items[i].key);
                }
            }
            res.send({
                success: true,
                data,
            });
        } else {
            res.send({
                success: false,
                error: "Unauthorized.",
            })
        }
    } catch(e) {
        console.warn(e);
        res.send({
            success: false,
            error: e,
        });
    }
})

app.post("/_api/markdown", (req, res) => {
    res.header('Content-Type', 'application/json');
    req.on('data', async function(ck) {
        try {
            res.send({
                success: true,
                html: marked.parse(ck.toString()),
            });
        } catch (e) {
            res.send({
                success: false,
                error: e,
            });
        }
    });
})

module.exports = app;