const { Deta } = require('deta');
const deta = Deta(process.env.DETA_DATA_KEY);
const db = deta.Base(process.env.BASE_NAME || 'detalk');


module.exports.exportData = async () => {
    let all = await db.fetch();
    let data = {};
    for (let i in all.items) {
        if (all.items[i].key.startsWith("CMT_")) {
            data[all.items[i].key] = all.items[i].value;
        }
    }
}