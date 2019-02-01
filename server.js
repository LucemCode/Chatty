"use strict"
//Imports
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var mongoose = require('mongoose');
var md5 = require('md5');

//MongoDB Verbindung
let dbUrl = "mongodb://localhost:27017/chatty"
let dbConnect = async function(dbUrl) {
    try {
        await mongoose.connect(dbUrl, {useNewUrlParser: true})
        console.log("Verbindung zur DB hergestellt")
    } catch (err) {
        console.log(err)
    }
}
dbConnect(dbUrl);

// Chat Schema
var chatSchema = mongoose.Schema({
    user: String,
    userID: String,
    msg: String,
    timeStamp: {type: Date, default: Date.now}
});
var chatSave = mongoose.model('Massage', chatSchema);

// User Schema
var userSchema = mongoose.Schema({
    username: String,
    email: String,
    pwd: String
});
var userDB = mongoose.model('User', userSchema);

//Server status
let port = 4000;
server.listen(port);
console.log("Server ist online auf Port " + port +"...");

// Express 
app.use(express.static('public'));

app.get("/", function(req, res){
    res.sendFile(__dirname + "/index.html");
});

app.get("/impressum", function(req, res){
    res.sendFile(__dirname + "/impressum.html");
});

//Chat Arrys
let user = [];
let connections = [];

//Socket.io
io.sockets.on('connection', function(socket){
    //Verbindungen herstellen
    connections.push(socket);
    //Verbindung loggen
    console.log("Verbunden: %s Sockets verbunden", connections.length);

    //Chat aus DB laden
    chatSave.find({}, function(err, docs){
        if(err) throw err;
        socket.emit('load old msg', docs)
    });
    
    //Verbindungen trennen
    socket.on('disconnect', function(socket){
        connections.splice(connections.indexOf(socket), 1);
        console.log("Verbunden: %s Sockets verbunden", connections.length);
    });

    //User einloggen
    socket.on('login user', function(userLogEmail, userLogPwd){
        var md5Pwd = md5(userLogPwd);
        userDB.findOne({"email": userLogEmail}, function(err, docs){
            if(err){console.log(err)};
            if(docs == null){
                socket.emit('login user fEmail');
            } else if(docs.email == userLogEmail){
                if(docs.pwd != md5Pwd){
                    socket.emit('login user fPwd');
                } else {
                    socket.username = docs.username;
                    socket.emit('login user erfolgreich', socket.username, docs._id);
                    //Chat aus DB laden
                    chatSave.find({}, function(err, docs){
                        if(err) throw err;
                        socket.emit('load old msg', docs)
                    });
                    console.log("Logge User " + socket.username + " ein");
                };
            };
        });
    });

    //User mit ID einloggen
    socket.on('login user with ID', function(username, userLogID){
        userDB.findOne({"username": username}, function(err, docs){
            if(err){console.log(err)};
            if(docs != null){
                userDB.findOne({"_id": userLogID}, function(err, docs){
                    if(err){console.log(err)};
                    if(docs != null){
                        socket.emit('login user erfolgreich', username, userLogID);
                    };
                });
            };
        });
    });

    //User regestrieren
    socket.on('reg user', function(userRegEmail, userRegPwd, userRegUsername){
        var md5Pwd = md5(userRegPwd)
        //Prüfen ob Nutzername schon vorhanden
        userDB.find({"username": userRegUsername}, function(err, docs){
            if(err){console.log(err)};
            if(docs.length == 0){
                //Prüen ob Email schon vorhanden
                userDB.find({"email": userRegEmail}, function(err, docs){
                    if(err){console.log(err)};
                    if(docs.length == 0){
                        socket.emit('reg user erfolgreich', userRegUsername);
                        var newUserToSave = new userDB({username: userRegUsername, email: userRegEmail, pwd: md5Pwd});
                        newUserToSave.save(function(err){
                            if(err) throw err;
                            console.log("Benutzer gespeichert");
                        });
                    } else {
                        socket.emit('reg user fEmail');
                    };
                });
            } else {
                socket.emit('reg user fUsername');
            };
        });
    });

    //Nachrichten senden
    socket.on('send massage', function(user, userID, data){
        socket.username = user
        console.log("Benutzer " + socket.username + " hat eine Nachricht gesendet: " + data);
        io.sockets.emit('new massage', {msg: data, user: socket.username});
        var newMsgToSave = new chatSave({msg: data, user: socket.username, userID: userID});
        newMsgToSave.save(function(err){
            if(err) throw err;
            console.log("Nachricht gespeichert");
        });
    });
});