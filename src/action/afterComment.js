// 只有评论成功才会执行
const { Deta } = require('deta');
const deta = Deta();
const db = deta.Base(process.env.BASE_NAME || 'detalk');
const fetch = require('node-fetch');
module.exports.afterComment = async ($data, $id) => {
    // console.log(db.get('FUNCTION_BEFORE_COMMENT').value || '');
    try {
        eval((await db.get('FUNCTION_AFTER_COMMENT')).value || '');
    } catch(e) {
        console.warn(e);
    }
    return $data;
}