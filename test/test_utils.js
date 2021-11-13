var assert = require('assert');
var utils = require('../lib/utils');
var rimraf = require("rimraf"); // for file clean up
const fs = require('fs')
const path = require('path');

const test_dirname = 'test_data_utils'
const test_path = path.join(__dirname, test_dirname)


describe('Utils', function() {

    describe('pathNormalize', function() {
      it('should throw if path is undefined', function() {
          assert.throws(utils.pathNormalize)
      });
      it('should expand path', function() {
          const res = utils.pathNormalize('.')
          assert(res.length>1)
      });
    });

  describe('pathRelative', function() {
    it('should throw if path is undefined', function() {
        assert.throws(utils.pathRelative)
    });

    it('should return relative path', function() {
        const res = utils.pathRelative('.', 'foo');
        assert.equal(res, 'foo')
    });
  });

  describe('pathDirname', function() {
    it('should throw if path is undefined', function() {
        assert.throws(utils.pathDirname)
    });

    it('should return dir path', function() {
        const res = utils.pathDirname('/foo/bar');
        assert.equal(res, '/foo')
    });
  });

  describe('make dir', function() {
      it('should create folder', function(done) {
          const test_dir_path = path.join(test_path, 'test_dir')
          utils.mkdirp(test_dir_path, done)
      });

      it('should create folder async', function(done) {
          const test_dir_path = path.join(test_path, 'test_dir')
          const p = utils.mkdirpAsync(test_dir_path)
          p.then(done)
      });
  });

  describe('loadYamlFile', function() {
    it('should load yaml file', function(done) {
        utils.mkdirp(test_path, ()=>{
            const test_file_path = path.join(test_path, 'test_file.yml')
            fs.writeFile(test_file_path, '- item', (err)=> {
                if(!err) {
                    utils.loadYamlFile(test_file_path, done)
                } else {
                    throw('file not created')
                }
            })
        })

    });


    it('should load yaml file async',  function(done) {
        utils.mkdirp(test_path, ()=>{
            const test_file_path = path.join(test_path, 'test_file2.yml')
            fs.writeFile(test_file_path, '- item', async (err)=> {
                if(!err) {
                    await utils.loadYamlFileAsync(test_file_path)
                    done()
                } else {
                    throw('file not created')
                }
            })
        })
    })

    it('should load yaml file sync',  function(done) {
        utils.mkdirp(test_path, ()=>{
            const test_file_path = path.join(test_path, 'test_file3.yml')
            fs.writeFile(test_file_path, '- item', async (err)=> {
                if(!err) {
                    utils.loadYamlFileSync(test_file_path)
                    done()
                } else {
                    throw('file not created')
                }
            })
        })
    })


  });

  describe('save json file', function() {
    it('should save json file', function(done) {
        utils.mkdirp(test_path, ()=>{
            const file_path = path.join(test_path, 'test_file.json')
            utils.storeJsonFile(file_path, {}, ()=> {
                done()
            })
        })
    })

    it('should save json file async', function(done) {
        utils.mkdirp(test_path, async ()=>{
            const file_path = path.join(test_path, 'test_file2.json')
            await utils.storeJsonFileAsync(file_path, {})
            done()
        })
    })
  })

  describe('save file', function() {
    it('should save json file', function(done) {
        utils.mkdirp(test_path, ()=>{
            const file_path = path.join(test_path, 'test_file.dat')
            utils.storeFile(file_path, 'moin', ()=> {
                done()
            })
        })
    })

    it('should save file async', function(done) {
        utils.mkdirp(test_path, async ()=>{
            const file_path = path.join(test_path, 'test_file2.dat')
            await utils.storeFileAsync(file_path, 'moin')
            done()
        })
    })
  })

  describe('load file', function() {
    it('should load file', function(done) {
        utils.mkdirp(test_path, ()=>{
            const test_file_path = path.join(test_path, 'test_file.dat')
            fs.writeFile(test_file_path, '- item', async (err)=> {
                if(!err) {
                    utils.loadFile(test_file_path, done)
                } else {
                    throw('file not created')
                }
            })
        })
    })

    it('should load file async', function(done) {
        utils.mkdirp(test_path, ()=>{
            const test_file_path = path.join(test_path, 'test_file.dat')
            fs.writeFile(test_file_path, '- item', async (err)=> {
                if(!err) {
                    await utils.loadFileAsync(test_file_path)
                    done()
                } else {
                    throw('file not created')
                }
            })
        })
    })
  })


   describe('findParentDir', function() {
       it('find parent dir', function(done) {
           utils.mkdirp(test_path, ()=>{
               const sub_dir = path.join(test_path, "a")
               utils.mkdirp(sub_dir, ()=>{
                   const file_name = 'file.dat'
                   const file_path = path.join(sub_dir, file_name)
                   fs.writeFile(file_path, 'moin', (err)=> {
                       if(!err) {
                           const res = utils.findParentDir(sub_dir, file_name)
                           assert.equal(res, sub_dir)
                           done()
                       } else {
                           throw('file not created')
                       }
                   })
               })
           })
       })

       it("don't find parent dir", function() {
           const file_name = 'file.dat'
           const sub_dir = path.join(test_path, "b")
           const file_path = path.join(sub_dir, file_name)
           const res = utils.findParentDir(sub_dir, file_name)
           assert(!res)
       })
   })

   describe('walk dir', function() {
       it('walk all files', function(done) {
           utils.mkdirp(test_path, ()=>{
               const test_file_name = 'c'
               const sub_dir = path.join(test_path, test_file_name)
               utils.mkdirp(sub_dir, ()=>{
                   utils.walkDir(test_path,
                       (file_name)=>{return file_name==test_file_name},
                        ()=>{done()},
                       ()=>{}
                    )
               })
           })
       })
   })


   describe('copy files', function() {
       it('copy file from a to b', function(done) {
           utils.mkdirp(test_path, ()=>{
               const test_file_name = "from.dat"
               const test_data = "moin moin"
               const file_path = path.join(test_path, test_file_name)
               fs.writeFile(file_path, test_data, (err)=> {
                   if(!err) {
                       const target_file_name = "to.dat"
                       const target_path = path.join(test_path, target_file_name)
                       utils.copyFile(file_path, target_path, (err)=> {
                           if(!err) {
                               utils.loadFileAsync(target_path).then((data)=>{
                                   assert.equal(data, test_data)
                                   done()
                               })
                           }
                       })
                   } else {
                       throw('file not created')
                   }
               })
           })
       })

       it('copy file from a to b async', function(done) {
           utils.mkdirp(test_path, ()=>{
               const test_file_name = "from.dat"
               const test_data = "moin moin"
               const file_path = path.join(test_path, test_file_name)
               fs.writeFile(file_path, test_data, (err)=> {
                   if(!err) {
                       const target_file_name = "to.dat"
                       const target_path = path.join(test_path, target_file_name)
                       utils.copyFileAsync(file_path, target_path).then( (err)=> {
                           if(!err) {
                               utils.loadFileAsync(target_path).then((data)=>{
                                   assert.equal(data, test_data)
                                   done()
                               })
                           }
                       })
                   } else {
                       throw('file not created')
                   }
               })
           })
       })
   })

   describe('watch file system', function() {
       it('watch folder', function(done) {
           utils.mkdirp(test_path, ()=>{
               done()
               return
               const watch_folder_name = "watch"
               const watch_folder_path = path.join(test_path, watch_folder_name)
               utils.mkdirp(watch_folder_path, ()=>{
                   const file_name = "test.dat"
                   const file_path = path.join(watch_folder_path, file_name)
                   const test_data = "aloha!"
                   fs.writeFile(file_path, test_data, (err)=> {
                       // var watch_callback = ()=> { let is_done = false; if(!is_done) {done(); is_done = true;} }
                       utils.watchFolder(watch_folder_path, done)
                       setTimeout(()=>{
                           fs.writeFile(file_path, test_data + " moin!", (err)=> {})
                       }, 10)
                   })
               })
           })
       })
   })





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
