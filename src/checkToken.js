const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base(process.env.BASE_NAME || 'detalk');
const md5 = require("js-md5");
module.exports.checkToken = async (token) => {
    let username = (await db.get('DETALK_USERNAME')).value;
    let password = (await db.get('DETALK_PASSWORD')).value;
    let tk = md5(new Date().getFullYear() + (new Date().getMonth() + 1) + username + password + "DETALK");
    if (tk == token) return true;
    else return false;
}