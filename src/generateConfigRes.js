const { Deta } = require('deta');
const deta = Deta(process.env.DETA_DATA_KEY);
const db = deta.Base(process.env.BASE_NAME || 'detalk');


module.exports.generateConfigRes = async (list) => {
    let res = {};
    for (let i in list) {
        let key = list[i];
        let value = (await db.get(key));
        res[key] = value;
    }
    return res;
}