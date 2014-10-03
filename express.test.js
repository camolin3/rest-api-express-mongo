var superagent = require('superagent')
var expect = require('expect.js')

describe('express rest api server', function() {
  var id

  it('posts an object', function(done) {
    superagent.post('http://localhost:28017/collections/tweets')
      .send({ name: 'John'
        , email: 'john@rpjs.co'
      })
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(res.body.length).to.eql(1)
        expect(res.body[0]._id.length).to.eql(24)
        id = res.body[0]._id
        done()
      })
  })

  it('retrieves an object', function(done) {
    superagent.get('http://localhost:28017/collections/tweets/'+id)
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(typeof res.body).to.eql('object')
        expect(res.body._id.length).to.eql(24)
        expect(res.body._id).to.eql(id)
        done()
      })
  })

  it('retrieves a collection', function(done) {
    superagent.get('http://localhost:28017/collections/tweets')
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(res.body.length).to.be.above(0)
        expect(res.body.map(function (item) {return item._id})).to.contain(id)
        done()
      })
  })

  it('updates an object', function(done) {
    superagent.put('http://localhost:28017/collections/tweets/'+id)
      .send({name: 'Peter'
        , email: 'peter@yahoo.com'})
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(typeof res.body).to.eql('object')
        expect(res.body.msg).to.eql('success')
        done()
      })
  })

  it('checks an updated object', function(done) {
    superagent.get('http://localhost:28017/collections/tweets/'+id)
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(typeof res.body).to.eql('object')
        expect(res.body._id.length).to.eql(24)
        expect(res.body._id).to.eql(id)
        expect(res.body.name).to.eql('Peter')
        done()
      })
  })
  it('removes an object', function(done) {
    superagent.del('http://localhost:28017/collections/tweets/'+id)
      .end(function(e, res) {
        // console.log(res.body)
        expect(e).to.eql(null)
        expect(typeof res.body).to.eql('object')
        expect(res.body.msg).to.eql('success')
        done()
      })
  })
})
