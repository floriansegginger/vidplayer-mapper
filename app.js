var express             = require('express');
var child               = require('child_process');

var app                 = express();

var expressWs           = require('express-ws')(app);
var path                = require('path');
var fs                  = require('fs');

app.use(express.static(path.join(__dirname, '/public')));

var mapFile = '/etc/pmw.d/mapping.conf.json';
var confFile = '/etc/pmw.d/vidplayer.conf.json';
var mountFile = '/proc/mounts';

var mountRWcmd = {cmd:'mount',args:['/','-o','remount,rw']};
var mountRcmd = {cmd:'mount',args:['/','-o','remount,ro']};
var killCmd = {cmd:'killall',args:['pmw-vidplayer']};
var rebootCmd = {cmd:'reboot',args:[]};
var screenShotCmd = {cmd:'pmw-screenshot',args:[]};

var screenshotTarget = path.join(__dirname, '/public/screenshot.png');
var screenshotSource = '/tmp/screenshot.png';

app.get('/', function(req, res, next) {
    res.redirect('/mapper.html');
});


app.ws('/api', function(ws,req) {

  var getMountMode = function()
  {
    var data = fs.readFileSync(mountFile, 'utf8');

    if((data.split(' '))[3].indexOf("rw") >= 0)
      return 'rw';
    
    return 'ro';
  }

  var sendMountMode = function()
  {
    ws.send(JSON.stringify({
      response      :'mountMode',
      data          : getMountMode()        
    }));
  }

  var sendConfig = function()
  {
    // console.log("Reading conf file...");

    var data = fs.readFileSync(confFile, 'utf8');

    ws.send(JSON.stringify({
      response      :'config',
      data          : JSON.parse(data)        
    }));
  }

  var sendMapping = function()
  {
    // console.log("Reading map file...");

    var data = fs.readFileSync(mapFile, 'utf8');

    // console.log(data);

    ws.send(JSON.stringify({
      response      :'mapping',
      data          : JSON.parse(data)        
    })); 
  }

  var sendScreenshot = function()
  {
    fs.writeFileSync(screenshotTarget, fs.readFileSync(screenshotSource));

    console.log("screenshot written to "+screenshotTarget);

    ws.send(JSON.stringify({
      response      :'screenshotUpdated'
    })); 
  }
  
  ws.on('message', function(msg) {

    var receivedMessage = JSON.parse(msg);

    // console.log(receivedMessage);

    switch(receivedMessage.request)
    {
      case 'getMapping':
        sendMapping();
      break;          
      case 'getMountMode':
        sendMountMode();
      break;
      case 'getConfig':
        sendConfig();
      break;        
      case 'setMapping':

        // console.log(JSON.stringify(receivedMessage.data));
        try
        {
          fs.writeFileSync(mapFile, JSON.stringify(receivedMessage.data,null,4));
        }
        catch(e)
        {
          console.error("Cannot write map file. Is the file system rw ?");
          sendMapping();          
        }
        
      break;
      case 'kill':
        retval = child.spawn(killCmd.cmd,killCmd.args,{timeout:3000,killSignal:'SIGKILL'});

        retval.on('close', function(code) {
          if(code !== 0)
            console.error('Child process '+killCmd.cmd+' exited with code '+code+': '+retval.stderr);
        });        
      break;
      case 'reboot':
        retval = child.spawn(rebootCmd.cmd,rebootCmd.args,{timeout:3000,killSignal:'SIGKILL'});

        retval.on('close', function(code) {
          if(code !== 0)
            console.error('Child process '+rebootCmd.cmd+' exited with code '+code+': '+retval.stderr);
        });  
      break;      
      case 'setMountMode':

        var retval = {};

        switch(receivedMessage.data)
        {
          case 'rw':
            retval = child.spawn(mountRWcmd.cmd,mountRWcmd.args,{timemout:3000,'killSignal':'SIGKILL'});
          break;
          case 'ro':
          default:
            retval = child.spawn(mountRcmd.cmd,mountRcmd.args,{timeout:3000,killSignal:'SIGKILL'});
          break;          
        }

        retval.on('close', function(code) {
          if(code !== 0)        
            console.error('Child process '+mountRcmd.cmd+' exited with code '+code+': '+retval.stderr);
        });  

        sendMountMode(); 

      break;
      case 'screenshot':
        retval = child.spawn(screenShotCmd.cmd,screenShotCmd.args,{timeout:5000,killSignal:'SIGKILL'});

        retval.on('close', function(code) {
          if(code !== 0)        
            console.error('Child process '+screenShotCmd.cmd+' exited with code '+code+': '+retval.stderr);

          sendScreenshot();                          
        });  

      break;
      case 'setConfig':

        try
        {
          fs.writeFileSync(confFile, JSON.stringify(receivedMessage.data,null,4));
        }
        catch(e)
        {
          console.error("Cannot write conf file. Is the file system rw ?");
          sendConfig();          
        }
      break;
    }
  });
});

app.listen(8000);