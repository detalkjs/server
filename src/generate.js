module.exports.generate = (pid) => {
    return require("./page/" + pid + ".js");
}