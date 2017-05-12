/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

require('babel-core/register');

var bl = require('bl');
var config = require('./package.json').config;
var express = require('express');
var fs = require('fs');
var mentionBot = require('./mention-bot.js');
var messageGenerator = require('./message.js');
var util = require('util');
var request = require('request');
var CONFIG_PATH = '.mention-bot';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";//ignore ssl errors

if (!process.env.GITLAB_TOKEN || !process.env.GITLAB_URL || !process.env.GITLAB_USER || !process.env.GITLAB_PASSWORD) {
  console.error('GITLAB_TOKEN, GITLAB_URL, GITLAB_USER, GITLAB_PASSWORD are required environment variables');
  process.exit(1);
}


var app = express();

function buildMentionSentence(reviewers) {
  var atReviewers = reviewers.map(function(owner) { return '@' + owner; });

  if (reviewers.length === 1) {
    return atReviewers[0];
  }

  return (
    atReviewers.slice(0, atReviewers.length - 1).join(', ') +
    ' and ' + atReviewers[atReviewers.length - 1]
  );
}

function defaultMessageGenerator(reviewers) {
  return util.format(
    'By analyzing the blame information on this pull request' +
     ', we identified %s to be%s potential reviewer%s',
     buildMentionSentence(reviewers),
     reviewers.length > 1 ? '' : ' a',
     reviewers.length > 1 ? 's' : ''
  );
};

app.post('/', function(req, res) {
  var eventType = req.get('X-Gitlab-Event');
  console.log('Received push event: ' + eventType);
  
  //only respond to merge request events
  if(eventType != 'Merge Request Hook'){
      return res.end();
  }

  req.pipe(bl(function(err, body) {
    var data = {};
    try { data = JSON.parse(body.toString()); } catch (e) {}
    if (data.object_attributes.state !== 'opened') {
      console.log(
        'Skipping because action is ' + data.object_attributes.state + '.',
        'We only care about opened.'
      );
      return res.end();
    }
      
    request({
        url : process.env.GITLAB_URL + '/api/v3/projects/' + data.object_attributes.target_project_id + '/merge_request/' + data.object_attributes.id + '/changes',
        headers : {
            'PRIVATE-TOKEN' : process.env.GITLAB_TOKEN
        }
    },function(error, response, body){
        if (error || response.statusCode != 200) {
            console.log('Error getting merge request diff: ' + error);
            return res.end();
        }
        
        var merge_data = {};
        try { merge_data = JSON.parse(body.toString()); } catch (e) {}
        
        mentionBot.guessOwnersForPullRequest(
            data.object_attributes.source.web_url,//repo url
            data.object_attributes.last_commit.id,//sha1 of last commit
            merge_data.changes,//all files for this merge request
            data.user.name, // 'mention-bot'
            {}
          ).then(function(reviewers){

          if (reviewers.length === 0) {
            console.log('Skipping because there are no reviewers found.');
            return;
          }
            request.debug = true;

            request.post({
                url : process.env.GITLAB_URL + '/api/v3/projects/' + data.object_attributes.target_project_id + '/merge_requests/' + data.object_attributes.id + '/comments',
                body: JSON.stringify({
                    note : messageGenerator(
                      reviewers,
                      buildMentionSentence,
                      defaultMessageGenerator)
                    }),
                headers : {
                    'PRIVATE-TOKEN' : process.env.GITLAB_TOKEN,
                    'Content-Type' : 'application/json'
                }
            },function(commentError, commentResponse, commentBody){
              if (commentError || commentResponse.statusCode != 200) {
                    console.log('Error commenting on merge request: ' + commentBody);
              }
          }); 
        });
        
        return res.end();        
    });
  }));
});

app.get('/', function(req, res) {
  res.send(
    'GitHub Mention Bot Active. ' +
    'Go to https://github.com/facebook/mention-bot for more information.'
  );
});

app.set('port', process.env.PORT || 5000);

app.listen(app.get('port'), function() {
  console.log('Listening on port', app.get('port'));
});
