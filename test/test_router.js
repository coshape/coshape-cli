var assert = require('assert');
var router = require('../lib/router');
var utils = require('../lib/utils');


var rimraf = require("rimraf"); // for file clean up
const fs = require('fs')
const path = require('path');
const request = require('supertest');
// const app = require('config/express');

const test_dirname = 'test_data_server'
const test_path = path.join(__dirname, test_dirname)

describe('Router', function() {
  describe('create router', function() {
    it('should not return null', function() {
        let rr = router.createRouter()
        assert(rr)
    })
  })

  describe('test routes', function() {
    it('test /api route', function() {
        let rr = router.createRouter()
        assert(rr)
        //request(rr)
        //    .get('/api')
        //    .then(done)
            //.expect('Content-Type', /json/)
            //.expect('Content-Length', '4')
            //.expect(200, "ok")
            //.end(function(err, res){
            //   //if (err) throw err;
            //   assert.equal(res, '{msg:"welcome to the api"}')
            //   done()
            //});

        // console.log(rr.stack[0])

        // rr.get('/api', (req, res) => {
        //     // console.log('result', res)
        //     done()
        // })

        // res.get('/api').then(res=>{
        //     assert.equal(res, '{msg:"welcome to the api"}')
        //     done()
        // })
    })

    it('test /api/urls route', function() {
        let res = router.createRouter()
        assert(res)
    })
  })
})
