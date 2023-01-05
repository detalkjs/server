const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base(process.env.BASE_NAME || 'detalk');
const fetch = require('node-fetch');

module.exports.githubLogin = async (token, cid) => {
    if (!(await db.get("GITHUB_OAUTH_SECRET")).value) return false;
    let secret = (await db.get("GITHUB_OAUTH_SECRET")).value;
    let access = await fetch(`https://github.com/login/oauth/access_token?client_id=${cid}&client_secret=${secret}&code=${token}`, {
        method: "POST",
        headers: {
            "Accept": "application/json"
        },
    }).then(res => res.json());
    console.log(access);
    access = access.access_token;
    let user = await fetch("https://api.github.com/user", {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": `token ${access}`,
        },
    }).then(res => res.json());
    return {
        success: true,
        nickname: user.name || user.login,
        email: user.email,
        link: user.blog || user.html_url,
    };
}