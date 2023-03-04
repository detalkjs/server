const { Deta } = require('deta');
const deta = Deta(process.env.DETA_DATA_KEY);
const db = deta.Base(process.env.BASE_NAME || 'detalk');
module.exports.getComment = async (id) => {
    const list = await db.get(id);
    return list;
}