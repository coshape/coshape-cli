#!/usr/bin/env node

var fs = require('fs');
var nomnom = require('nomnom');

var opts = nomnom
    .script('coshape')
    .option('command', {
        position: 0,
        help: "Command is on of these: 'create', 'search', 'sync', 'upadte', 'upload', 'download'",
    })
    .option('version', {
        abbr: 'v',
        flag: true,
        help: "Print version and exit",
        callback: function() {
            return require('../package.json').version;
        }
    })
    .parse();

console.log("Coshape Cli")
console.log("options:")
console.log(opts.out);
