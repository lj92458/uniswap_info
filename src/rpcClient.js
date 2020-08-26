const hprose = require("hprose");
const client = hprose.Client.create("http://47.241.129.239:8090/");


export const rpcProxy = client.useService();