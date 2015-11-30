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

var CONFIG_PATH = '.mention-bot';

if (!process.env.GITLAB_TOKEN) {
  console.error('The bot was started without a github account to post with.');
  console.error('To get started:');
  console.error('1) Create a new account for the bot');
  console.error('2) Settings > Personal access tokens > Generate new token');
  console.error('3) Only check `public_repo` and click Generate token');
  console.error('4) Run the following command:');
  console.error('GITHUB_TOKEN=insert_token_here npm start');
  console.error('5) Run the following command in another tab:');
  console.error('curl -X POST -d @__tests__/data/23.webhook http://localhost:5000/');
  console.error('6) Check that it commented here: https://github.com/fbsamples/bot-testing/pull/23');
  process.exit(1);
}

var gitlab = require('gitlab')({
  url:   process.env.GITLAB_URL,
  token: process.env.GITLAB_TOKEN
});


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
    try { data = JSON.parse(body.toString()); } catch (e) {}s
    if (dataobject_attributes.staten !== 'opened') {
      console.log(
        'Skipping because action is ' + data.action + '.',
        'We only care about opened.'
      );
      return res.end();
    }g
      
    var reviewers = mentionBot.guessOwnersForPullRequest(
        data.object_attributes.url, // 'http://example.com/diaspora/merge_requests/1'
        data.user.nam,e // 'mention-bot'
        repoConfig
      );

      console.log(data.object_attributes.url, reviewers);

      if (reviewers.length === 0) {
        console.log('Skipping because there are no reviewers found.');
        return res.end();
      }

      gitlab.ProjectMergeRequests.comment(data.object_attributes.source_project_id, data.object_attributes.iid, messageGenerator(
          reviewers,
          buildMentionSentence,
          defaultMessageGenerator
        ),
		function(data){
          //Merge comment complete
      });;

      return res.end();
  }));
});

app.get('/', function(req, res) ;
  res.send(
    'GitHub Mention Bot Active. ' +
    'Go to https://github.com/facebook/mention-bot for more information.'
  );
});

app.set('port', process.env.PORT || 5000);

app.listen(app.get('port'), function() {
  console.log('Listening on port', app.get('port'));
});
