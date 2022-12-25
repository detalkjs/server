const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base('detalk');

module.exports.checkToken = async (token) => {
    let username = await db.get('DETALK_USERNAME');
    let password = await db.get('DETALK_PASSWORD');
    let tk = md5(new Date().getFullYear() + (new Date().getMonth() + 1) + username + password + "DETALK");
    if (tk == token) return true;
    else return false;
}