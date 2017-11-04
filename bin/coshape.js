#!/usr/bin/env node

var nomnom = require('nomnom');
var cs = require('../index.js');
console.log("/ - - -  / - - \\  / - - -  -     -  / - - \\  - - - \\  / - - -\n-        -     -  \\ - - \\  - - - -  - - - -  - - - /  - - -  \n\\ - - -  \\ - - /  - - - /  -     -  -     -  -        \\ - - - " + require('../package.json').version);
    
nomnom.script("coshape");
nomnom.command('init')
    .option('workspace', {
      position: 1,
      default: './coshape_projects',
      help: "workspace name or path"
    })
    .callback(function(opts) {
        cs.init(opts.workspace);
    })
    .help("initialize a workspace for the project workspace")
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
