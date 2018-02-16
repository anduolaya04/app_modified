/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
require('dotenv').config({
  silent: true
});
var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Watson = require('watson-developer-cloud/conversation/v1'); // watson sdk
var Discovery = require('watson-developer-cloud/discovery/v1'); // watson sdk
const Context = require('./context');
const Output = require('./output');
const Input = require('./input');
const Cloudant = require('./cloudant');
var app = express();
// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());
// Create the service wrapper
var conversation = new Watson({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-09-20',
  version: 'v1'
});
var discovery = new Discovery({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  //url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-12-15',
  version: 'v1'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };
  if (req.body) {
    if (req.body.input) {
      payload.input = JSON.parse(Input.replaceTagsUserInput(JSON.stringify(
        req.body.input)));
    }
    if (req.body.context) {
      payload.context = Context.setContextToWatson(JSON.parse(JSON.stringify(
        req.body.context)), payload.input);
    }
  }
  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    Context.setContextAfterWatson(data);
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    
    if (data.context.discovery){
    	delete data.context.discovery;
    	discovery.query({
    		collection_id: "210ee7c0-8b57-46ec-aa11-7db62fdc71ec",
    		environment_id:"28543497-eb8c-4a64-9f43-502eab69d305",
    		query: data.input.text,
    		count: 5
    	},
    	function(err, searchResponse){
    	data.output.text = [];
        if (err) {
          console.error(err);
          console.log('Discovery error searching for documents: ' + err);
          data.output.text.push("Ocurrió un error inesperado en el servicio de Discovery.<br>Por favor, intenta nuevamente.");
        }
        else {
          var docs = searchResponse.results;
            
          if (docs.length > 0) {
            console.log("found ", docs.length, " documents matching discovery query");
            var responseText = "Excelente pregunta. Encontré algunas ideas para ti:<br>";
            
            for (var i = 0; i < docs.length; i++) {
              responseText += "<div class='docContainer'>"+
                "<div title='Ver contenido' class='docBody'>"+
                    "<div class='docBodyTitle'>"+
                      docs[i].extracted_metadata.title +
                    "</div>"+
                    "<div class='docBodySnippet'>"+
                      docs[i].text +
                    "</div>"+
                  "</div>"+
                  "<div class='modal' hidden>"+
                  "<div class='modal-header'>"+
                    "<div class='modal-doc'>"+
                      docs[i].extracted_metadata.title +
                    "</div>"+
                    "<span class='modal-close'>"+
                      "<img src='img/close-button.png' class='close-button'>"+
                    "</span>"+
                  "</div>"+
                  //"<div class='modalDocTitle'>"+
                    //"<a title='Abrir documento' target='_blank' class='docLink' href='#'>"+
                      //"<div class='titleText'>Lee el documento completo aquí</div>"+
                    //"</a>"+
                  //"</div>"+
                  "<div class='bodyText'>"+
                    docs[i].text +
                  "</div>"+
                  //"<div class='disclaimer' hidden>Disclaimer.</div>"+
                "</div>"+
                //"<div class='docTitle'>"+
                  //"<a title='Abrir documento' target='_blank' class='docLink' href='#'>"+
                    //"<div class='titleText'>Lee el documento completo aquí</div>"+
                  //"</a>"+
                //"</div>"+
              "</div>";
            }
            responseText = responseText.replace(/\n/g, "<br>"); //replace \n with <br> to format the response for browsers
            //console.log("response text, discovery service: ", responseText);
            
            data.output.text.push(responseText);
          }
          else {
            console.log("0 discovery documents found.");
            data.output.text.push("Lo siento, no encontré nada para ayudarte con ese problema.");
          }
        }

    	});
    	return res.json(data);
    }

	console.log(data.output.text);
	data.output.text = JSON.parse(Output.replaceTags(JSON.stringify(
  data.output.text)));
	console.log(data.output.text);
	return res.json(Cloudant.updateMessage(payload, data));
  });
});
Cloudant.saveLastMessage();
//BOTS
var bots = require('./bots');
app.use('/', Cloudant.app);
app.use('/', bots);
module.exports = app;
