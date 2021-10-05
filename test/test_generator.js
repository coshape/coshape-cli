var assert = require('assert');
var rimraf = require("rimraf"); // for file clean up
var generator = require('../lib/generator');

const path = require('path');

const test_dirname = 'test_data_generator'
const test_path = path.join(__dirname, test_dirname)
const test_workspace_path = path.join(test_path, "workspace")
const test_project_path = path.join(test_workspace_path, "project")


describe('Generator', function() {
  describe('create settings', function() {
    it('should create a default settings object', function() {
      assert(generator.createSettings("/"));
    });
  });

  describe('create workspace', function() {
      it('should throw w/o parameter', function() {
          assert.throws(generator.createWorkspace)
      });

      it('should create new workspace', function() {
          const settings = generator.createSettings(test_workspace_path);
          generator.createWorkspace(settings)
          // todo: ... make async and check FS
      });

      // it('should throw, if workspace path already exists', function() {
    //       const settings = generator.createSettings(test_workspace_path);
    //       generator.createWorkspace(settings)
    //       setTimeout(()=> {
    //           assert.throws(()=> {generator.createWorkspace(settings) })
    //       }, 30000)
      // });
  });

  describe('create project', function() {
      it('should throw w/o parameter', function() {
          assert.throws(generator.createProject)
      });

      it('should create new project', function() {
          const ppath = test_project_path
          generator.createProject(ppath)
      });

      // it('should throw, project path exists', function() {
    //       const ppath = test_project_path
    //       generator.createProject(ppath)
    //       assert.throws(()=> {generator.createProject(ppath)})
      // });
  });


  describe('build workspace', function() {
        it('should build default project in workspace', async function() {
            const ppath = test_project_path + "_build"
            // const settings = generator.createSettings(test_workspace_path)
            generator.createProject(ppath)
            // await generator.buildCachedProjectAsync(ppath, settings.workspace.root)
            await generator.buildWorkspace(ppath)

        });
    });

    /*
    describe('build cached workspace', function() {
          it('should build default project in cached workspace', function(done) {
              const ppath = test_project_path + "_build_cached"
              // const settings = generator.createSettings(test_workspace_path)
              generator.createProject(ppath)
              const base_path = path.resolve(ppath);
              generator.buildCachedWorkspace(base_path, () => {
                  done();
              })

          });
      });
      */



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
