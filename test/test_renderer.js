var assert = require('assert');
var renderer = require('../lib/renderer');

var rimraf = require("rimraf"); // for file clean up
const utils = require('../lib/utils')
const fs = require('fs')
const path = require('path');

const test_dirname = 'test_data_renderer'
const test_path = path.join(__dirname, test_dirname)

describe('Renderer', function() {
    describe('render sync', function() {
      it('render to file', function(done) {
          utils.mkdirp(test_path, ()=>{
              const template_file_path = path.join(test_path, "temp.dat");
              fs.writeFileSync(template_file_path, "{{label}}");
              const doc_data = {label: "foo"}
              const output_file_path = path.join(test_path, "result.txt")
              renderer.renderSync(template_file_path, doc_data, output_file_path)
              const res = fs.readFileSync(output_file_path)
              assert.equal(res, doc_data.label)
              done()
          })

      });
    });

    describe('render sync', function() {
      it('render to file', function() {
              const doc_data = {label: "foo"}
              const res = renderer.renderProject(doc_data, "{{label}}")
              assert.equal(res, doc_data.label)
      });
    });

  describe('expandProject()', function() {
    it('should throw', function() {
      assert.throws(renderer.expandProject)
    });
    it('should not return null', function() {
        const obj = {
            interface: {test: {value: 1}},
            components: [{
                name: "foo",
                position:{},
                rotation: {},
                scale: {},
                sub_io: {a:{expression:"1"}}
            },
            {
                name: "foo2",
                position:{x:1, y:1, z:1},
                rotation: {x:1, y:1, z:1},
                scale: {x:1, y:1, z:1},
                sub_io: {a:{value:"1"}},
                parameters: {a: 1}
            }]
        }
        var res = renderer.expandProject(obj)
    });
  });

  describe('render projects', function() {
    it('render project overview', function(done) {
        utils.mkdirp(test_path, ()=>{
            renderer.renderProjects(['moin'], (res)=>{

                done()
            })
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
