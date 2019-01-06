"use strict"
//Server config
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var mongoose = require('mongoose');

//MongoDB Verbindung
mongoose.connect('mongodb://localhost:27017/chat', {useNewUrlParser: true}, function(err){
    if(err) throw err;
    else console.log("Verbindung zur DB hergestellt");
});

var chatShema = mongoose.Schema({
    user: String,
    msg: String,
    timeStamp: {type: Date, default: Date.now}
});

var chatSave = mongoose.model('Massage', chatShema);

//Server status
let port = 4001;
server.listen(port);
console.log("Server ist online auf Port " + port +"...");

app.use(express.static('public'));

//Anfragen hanlder
app.get("/", function(req, res){
    res.sendFile(__dirname + "/index.html");
});

app.get("/impressum", function(req, res){
    res.sendFile(__dirname + "/impressum.html");
});

app.get("/beta", function(req, res){
    res.sendFile(__dirname + "/index.copy.html");
});

//Chatty Arrys
let user = [];
let connections = [];

//Socket handler
io.sockets.on('connection', function(socket){
    //Verbindungen herstellen
    connections.push(socket);
    
    //UserID erstellen und aus Array connections lesen
    var userID = connections.length;

    //Verbindung loggen
    console.log("Verbunden: %s Sockets verbunden", connections.length);

    //Chat aus DB laden
    chatSave.find({}, function(err, docs){
        if(err) throw err;
        console.log("Alter Nachrichten werden geladen für UserID " + userID);
        socket.emit('load old msg', docs);
    });

    //Verbindungen trennen
    socket.on('disconnect', function(socket){
        connections.splice(connections.indexOf(socket), 1);
        console.log("Verbunden: %s Sockets verbunden", connections.length);
    });

    //Neuer Benutzer regestrieren
    socket.on('new user', function(data, callback){
        callback(true);
        socket.username = data;
        user.push(socket.username);
        console.log("Benutzer " + socket.username + " regestriert")
    });

    //Nachrichten senden
    socket.on('send massage', function(data){
        console.log("Benutzer " + socket.username + " mit ID " + userID + " hat eine Nachricht gesendet: " + data);
        io.sockets.emit('new massage', {msg: data, user: socket.username});
        var newMsgToSave = new chatSave({msg: data, user: socket.username});
        newMsgToSave.save(function(err){
            if(err) throw err;
            console.log("Nachricht gespeichert");
        });
    });

});

