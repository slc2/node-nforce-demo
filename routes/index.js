
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Welcome to the Salesforce CRUD demo with Node.js' })
};