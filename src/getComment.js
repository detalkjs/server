const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base('detalk');
module.exports.getComment = async (id) => {
    const list = await db.get(id);
    return list;
}