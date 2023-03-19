module.exports.textconvert = (text) => {
    text = text.replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});
    text = text.replace(/\r?\n/g," ");
    text = text.replace(/((\s|&nbsp;)*\r?\n){1,}/g,"\r\n\r\n");
    text = text.replace(/^((\s|&nbsp;)*\r?\n)+/g,'');
    text = text.replace(/((\s|&nbsp;)*\r?\n)+$/g,'');
    return text;
}