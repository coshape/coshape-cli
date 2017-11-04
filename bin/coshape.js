#!/usr/bin/env node

var nomnom = require('nomnom');
var cs = require('../index.js');
console.log("/ - - -  / - - \\  / - - -  -     -  / - - \\  - - - \\  / - - -\n-        -     -  \\ - - \\  - - - -  - - - -  - - - /  - - -  \n\\ - - -  \\ - - /  - - - /  -     -  -     -  -        \\ - - - " + require('../package.json').version);
    
nomnom.script("coshape");
nomnom.command('init')
    .option('collection', {
      position: 1,
      default: './coshape_projects',
      help: "collection name or path"
    })
    .callback(function(opts) {
        cs.init(opts.collection);
    })
    .help("initialize a workspace for the project collection")
nomnom.command('new')
    .option('project', {
      position: 1,
      help: "project name or path"
    })
    .callback(function(opts) {
        cs.init(opts.project);
    })
    .help("create a new project")
nomnom.command('build')
    .option('project', {
      position: 1,
      default: '.',
      help: "project name or path"
    })
    .callback(function(opts) {
        cs.build(opts.project);
    })
    .help("build project in current working directory or provided path")
nomnom.command('host')
.option('project', {
      position: 1,
      default: '.',
      help: "project name or path"
    })
    .callback(function(opts) {
        cs.host(opts.project);
    })
    .help("host project in current working directory or provided path")
nomnom.parse();   
