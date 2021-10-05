var assert = require('assert');
var server = require('../lib/server');
var router = require('../lib/router');
var utils = require('../lib/utils');



var rimraf = require("rimraf"); // for file clean up
const fs = require('fs')
const path = require('path');

const test_dirname = 'test_data_server'
const test_path = path.join(__dirname, test_dirname)

describe('Server', function() {
  describe('host', function() {
    it('run server', function(done) {
        utils.mkdirp(test_path, ()=>{
            const app = server.host(test_path)
            setTimeout(() => {
                app.close()
                server._connection.keepAliveTimeout = 100
                setTimeout(() => {
                    // server._connection.
                    // console.log(server._connection)
                    server.reload.closeServer()
                    done()
                }, 10)
            }, 10);
        })
    });
  });

  before(function() {
      // runs before all tests in this block
  });

  after(function() {
      // runs after all tests in this block
      // console.log('delete ', test_path)
      rimraf(test_path, function() { });
  });

  beforeEach(function() {
      // runs before each test in this block
  });

  afterEach(function() {
      // runs after each test in this block
      // rimraf(test_path, function() { });
  });

});
