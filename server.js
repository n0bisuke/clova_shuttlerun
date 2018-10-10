'use strict';

const clova = require('@line/clova-cek-sdk-nodejs');
const line = require('@line/bot-sdk');
const express = require('express');

const app = new express();
const port = process.env.PORT || 1880;
let audioPath = '';

app.use(express.static('static'));
app.use((req, res, next) => {
    audioPath = `https://${req.headers.host}/audio/shuttlerun.mp3`;
    next();
});

//EXTENSION IDとLINE ACCESS TOKEN
const clovaMiddleware = clova.Middleware({applicationId: process.env.LBA_SHUTTLERUN_CLOVA});
const client = new line.Client({channelAccessToken: process.env.LBA_SHUTTLERUN_TOKEN});

let counter = 0;

const audioObject = (options) => {
    const directives = [{
        "header": {
            "namespace": "AudioPlayer",
            "name": "Play",
            "dialogRequestId": options.dialogRequestId,
        },
        "payload": {
            "audioItem": {
                "audioItemId": 'shuttle-run',
                "title": '20mシャトルラン',
                "artist": "unknown",
                "stream": {
                    "beginAtInMilliseconds": 7 * 1000, //~秒からスタート
                    "durationInMilliseconds": (22 * 60 * 1000) + 3000, //~秒間再生する シャトルランのMAXが22分3秒
                    "progressReport": {
                        // "progressReportDelayInMilliseconds": 10 * 1000,
                        "progressReportIntervalInMilliseconds": 10 * 1000,
                        // "progressReportPositionInMilliseconds": [5 * 1000,5 * 1000,20 * 1000]
                    },
                    "token": options.dialogRequestId,
                    "url": audioPath,
                    "urlPlayable": true
                }
            },
            "playBehavior": "REPLACE_ALL"
        }
    }];

    return {
        "version": "1.0",
        "sessionAttributes": {},
        "response": {
            "card": {},
            "directives": directives,
            "outputSpeech": {
                "type": "SimpleSpeech",
                "values": {
                    "type": "PlainText",
                    "lang": "ja",
                    "value": options.speech
                }
            },
            "shouldEndSession": false
        }
    }
}

const clovaSkillHandler = clova.Client
    .configureSkill()

    //起動時
    .onLaunchRequest(async responseHelper => {
        const message = {
            type: 'text',
            text: '20mシャトルランを起動します。少々お待ち下さい。'
        };

        const options = {
            speech: message.text,
            dialogRequestId: responseHelper.requestObject.request.requestId
        };
        responseHelper.responseObject = audioObject(options);

        await client.pushMessage(responseHelper.getUser().userId, message)
    })

    //ユーザーからの発話が来たら反応する箇所
    .onIntentRequest(async responseHelper => {})
    
    //カスタムイベント
    .onEventRequest(async responseHelper => {
        const eventName = responseHelper.requestObject.request.event.name;
        console.log(`---custom-event[${eventName}]--`)
        
        if(eventName === 'PlayStarted'){
            console.log(`スタートします。`);
        }

        if(eventName === `ProgressReportIntervalPassed`){
            counter++;
            if(counter < 1)return;

            const message = {
                type: 'text',
                text: counter-1
            };
            await client.pushMessage(responseHelper.getUser().userId, message)
        }
        
        if(eventName === `ProgressReportDelayPassed`){}
        if(eventName === `PlayPaused` || eventName === `PlayStopped`){
            console.log('一時停止中...')
        }

        if(eventName === `PlayFinished`){
            console.log(`お疲れ様でした。`);
        }
    })

    //終了時
    .onSessionEndedRequest(responseHelper => {
        const sessionId = responseHelper.getSessionId();
    })
    .handle();

app.post('/clova', clovaMiddleware, clovaSkillHandler);
app.listen(port, () => console.log(`Server running on ${port}`));