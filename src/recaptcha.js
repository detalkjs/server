const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base(process.env.BASE_NAME || 'detalk');
const fetch = require('node-fetch');

function inarray(arr, val) {
    for (let i of arr) {
        if (i == val) return true;
    }
    return false;
}


module.exports.recaptcha_verify = async (token) => {
    try {
        if (!(await db.get('RECAPTCHA_SECRET')) || !(await db.get('RECAPTCHA_SECRET')).value) {
            return true;
        }
        if ((await db.get('ACCESS_SECRET')) && (await db.get('ACCESS_SECRET')).value && inarray((await db.get('ACCESS_SECRET')).value, token)) {
            return true;
        }

        const secret = (await db.get('RECAPTCHA_SECRET')).value;
        const limit = (await db.get('RECAPTCHA_LIMIT')).value || 0.5;
        const reqUrl = `https://recaptcha.net/recaptcha/api/siteverify?secret=${secret}&response=${token}`;
        let resp = await fetch(reqUrl).then(res => res.json());
        console.log(resp);
        if (resp.success && resp.score >= limit) return true;
        else return false;
    } catch(e) {
        return false;
    }
};