var express = require('express')
  , routes = require('./routes')
  , util = require('util')
  . async = require('async')
  , nforce = require('nforce');

var port = process.env.PORT || 3001; // use heroku's dynamic port or 3001 if localhost
var oauth;


// test with DE org 1
var cid = process.env.CLIENT_ID || "yourclientid";
var csecr = process.env.CLIENT_SECRET || "yourclientsecret";
var lserv = process.env.LOGIN_SERVER || "https://login.salesforce.com";
var redir = process.env.REDIRECT_URI || 'http://localhost:' + port + '/oauth/_callback';
var username = process.env.USERNAME || 'ausername@xx.com';
var password = process.env.PASSWORD || 'apassword'

// use the nforce package to create a connection to salesforce.com
var org = nforce.createConnection({
  clientId: cid,
  clientSecret: csecr,
  redirectUri: redir,
  apiVersion: 'v24.0',  // optional, defaults to v24.0
  environment: 'production'  // optional, sandbox or production, production default
});

// authenticate using username-password oauth flow
org.authenticate({ username: username, password: password }, function(err, resp){
  if(err) {
    console.log('Error: ' + err.message);
  } else {
    oauth = resp;
  }
});

// create the server
var app = module.exports = express.createServer();

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes
app.get('/', routes.index);

// display a list of 10 accounts
app.get('/accounts', function(req, res) {
  org.query({ query: 'select id, name from account limit 10', oauth: oauth }, function(err, resp){
    res.render("accounts", { title: 'Accounts', data: resp.records } );
  });
});

// display form to create a new account
app.get('/accounts/new', function(req, res) {
  // call describe to dynamically generate the form fields
  org.getDescribe({type: 'Account', oauth: oauth}, function(err, resp) {
    res.render('new', { title: 'New Account', data: resp })
  });
});

// create the account in salesforce
app.post('/accounts/create', function(req, res) {
  var obj = nforce.createSObject('Account', req.body.account);
  org.insert({sobject: obj, oauth: oauth}, function(err, resp){
    if (err) {
      console.log(err);
    } else {
      if (resp.success == true) {
        res.redirect('/accounts/'+resp.id);
        res.end();
      }
    }
  })
});

// display the account
app.get('/accounts/:id', function(req, res) {

  var async = require('async');
  var obj = nforce.createSObject('Account', {id: req.params.id});

  async.parallel([
      function(callback){
        org.query({query: "select count() from contact where accountid = '" + req.params.id + "'", oauth: oauth}, function(err, resp){
          callback(null, resp);
        });
      },
      function(callback){
        org.getRecord({sobject: obj, oauth: oauth}, oauth, function(err, resp) {
          callback(null, resp);
        });
      },
  ],
  // optional callback
  function(err, results){
    // returns the responses in an array
    res.render('show', { title: 'Account Details', data: results });
  });  

});

// display form to update an existing account
app.get('/accounts/:id/edit', function(req, res) {
  var obj = nforce.createSObject('Account', {id: req.params.id});
  org.getRecord({sobject: obj, oauth: oauth}, oauth, function(err, resp) {
    res.render('edit', { title: 'Edit Account', data: resp });
  });
});

// update the account in salesforce
app.post('/accounts/:id/update', function(req, res) {
  var obj = nforce.createSObject('Account', req.body.account);
  org.update({sobject: obj, oauth: oauth}, function(results) {
    res.redirect('/accounts/'+req.params.id);
    res.end();
  }); 
});

app.listen(port, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
