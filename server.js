const express = require('express');
const io = require('socket.io');
const axios = require('axios');
const morgan = require('morgan');
const cors = require('cors');
const ipHost = process.argv[2];
const port = process.argv[3];
const adressMiddleware = process.argv[4];


const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

const server = app.listen(port, () => {
    console.log('Escuchando en el puerto node client: ' + port);
});

var valueNode = Math.floor(Math.random() * (100 - 1) + 1);
var listNodes = [];
var leader = '';
var isLeader = 0;
var interval;
var give = 1;
var recivedMax = 0;
var timeAlive = timeRandom();
var host = 'http://' +ipHost+':'+port;
let hostSocket = io(server);

hostSocket.on('connection', node => {
    console.log('Nueva conexión:', node.id);
    //botton ya no quiero ser lider
    node.on('give', () => {
        console.log('Ya no quiero ser lider');
        isLeader = 0;
        give = 0;

    //aviso a la vista que no quiero ser lider en caso de no ser lider
        hostSocket.emit('give',{
            Host: host,
            Value: valueNode,
            IsLeader: isLeader,
            Leader: leader,
            Message : 'Ya no quiero ser lider'
        });
    });

    axios.post('http://' + adressMiddleware +'/newConn', {
        value: valueNode,
        url: 'http://'+ipHost+':'+ port
    }).then((response) => {
        console.log('new node: ' + response.data.list);
        listNodes = JSON.parse(response.data.list);
        leader = '';
        listNodes.forEach(element => {
            if (element.url == host && element.leader == 1) {
                //soy el lider?
                isLeader = 1;
            } else if (element.leader == 1) {
                //quien es el lider?
                leader = element.url;
                console.log('el lider es: ' + leader);
            }

            if(element.url == host){
                valueNode = element.value
            }
        });
        //notificar a ala vista que entre 
        hostSocket.emit('newConn',{
            Host: host,
            Value: valueNode,
            IsLeader: isLeader,
            Leader: leader,
            Message: 'Hola soy un nuevo nodo'
            });
    }).catch((error) => {
        console.log(error);
    });
});


app.post('/updateList', function (req, res, next) {
    var data = req.body;
    console.log('update list: ' + data.list);
    listNodes = JSON.parse(data.list);
    //validar si soy el lider o quien es
    leader = '';
    listNodes.forEach(element => {
        if (element.url == host && element.leader == 1) {
            //soy el lider?
            isLeader = 1;
        } else if (element.leader == 1) {
            //quien es el lider?
            leader = element.url;
            isLeader = 0;
            console.log('el lider es: ' + leader);
        }

        if(element.url == host){
            valueNode = element.value
        }
    });
    res.json({
        message: 'Recibi update'
    });
    give = 1;
    //actualizar vista cada que se haga un update
    hostSocket.emit('updateList',{
        updateList: JSON.stringify(listNodes)
    });

    interval = setInterval(latido, timeAlive);
});

app.post('/choise',function (req, res, next) {
    console.log(req.body);
    //parando las pulsaciones
    clearInterval(interval);
    //Evaluo si entro en la eleccion
    if(req.body.value < valueNode){
        console.log('entro en la elección');
        //envio a ala vista que entro a participar
        hostSocket.emit('participate',{
            Host: host,
            Value: valueNode,
            IsLeader: isLeader,
            Leader: leader,
            Message: 'Elección / Entro en la elección'
        })
    res.json({
        url:host,
        value:valueNode
    });
  }else{
    console.log('no responden por valor inferior');
     //envio a ala vista que no entro a participar
    hostSocket.emit('Notparticipate',{
        Host: host,
        Value: valueNode,
        IsLeader: isLeader,
        Leader: leader,
        Message: 'Elección / No puedo entrar a la elección'
    })

  }
});

app.post('/reportLeader', function(req, res, next){
    //vista del nuevo leader
    hostSocket.emit('newLeader',{
        Host: host,
        Value: valueNode,
        IsLeader: isLeader,
        Leader: leader,
        Message: 'el nuevo lider es: ' + req.body.leader
    });
    res.json({
        message:'he recibido el nuevo lider'
    });
});

app.get('/alive', function (req, res) {
    //vista para si quiero seguir siendo lider
    hostSocket.emit('alive',{
        Host: host,
        Value: valueNode,
        IsLeader: isLeader,
        Leader: leader,
        Message: 'Me estan preguntando si quiero seguir siendo lider...'
    })
    res.json({
        give: give
    });
});



async function latido() {
    console.log('timeRandom: ' + timeAlive);
    if(isLeader == 0){
        //vista para mostrar que estoy haciendo pulsaciones
        hostSocket.emit('pulsation',{
            Host: host,
            Value: valueNode,
            IsLeader: isLeader,
            Leader: leader,
            Message: 'Estoy haciendo pulsacion al: ' + leader
        });

            await axios.get(leader + '/alive')
                .then((response) => {
                    console.log('¿QUIERE SEGUIR? ' + response.data.give);
                    if(response.data.give == 1){
                        timeAlive = timeRandom();
                        console.log('new time: ' + timeAlive);
                        //vista cuando el lider quiere seguir siendo lider
                        hostSocket.emit('detected',{
                            Host: host,
                            Value: valueNode,
                            IsLeader: isLeader,
                            Leader: leader,
                            Message: 'El lider: ' + leader + ' seguira siendo lider'
                        });

                    }else{
                        console.log('nueva eleccion, yo paro mi pulsación');
                        //vista cuando detecto que el lider ya no quiere ser lider
                        hostSocket.emit('Nodetected',{
                            Host: host,
                            Value: valueNode,
                            IsLeader: isLeader,
                            Leader: leader,
                            Message: 'El lider: ' + leader + ' ya no quiere ser lider'
                        });

                        clearInterval(interval);
                        election();
                    }
                })
                .catch((error) => {
                   console.log(error.code);
                   clearInterval(interval);
                });
        }
}

interval = setInterval(latido, timeAlive);

function election(){
    recivedMax = 0;

    //vista de eleccion de un nuevo lider
    hostSocket.emit('choise',{
        Host: host,
        Value: valueNode,
        IsLeader: isLeader,
        Leader: leader,
        Message: 'He lanzado una elección a los otros nodos'
    });

    listNodes.forEach(element => {
        if(element.url != host && element.url != leader){
            axios.post(element.url+'/choise', {
                value: valueNode,
                url:host
            })
            .then((response) => {
                console.log('llegan los nodos en elección');
                console.log(response.data);
                recivedMax = 1;
                //metodo para elegir max
                if(response.data.value == getMaxNode()){
            
                    //envio de leader a los nodos
                    reportLeader(response.data.url);
                    isLeader = 0;
                    console.log('if de max node: ' + response.data.value);
                    axios.post('http://'+adressMiddleware+'/newLeader',{
                             newLeader: response.data.url
                        }).then((response) => {
                            console.log(response.data.message);
                        }).catch((error) => {
                             console.log(error.code);
                        });
                    }
            })
            .catch((error) => {
                console.log(error.code);
                console.log('no responden por valor inferior');
            })
        }
    });
    if(recivedMax == 0 && valueNode == getMaxNode()){
        console.log('detecto la caida y soy el lider');
        //envio de leader a los nodos
        reportLeader(host);
        axios.post('http://'+adressMiddleware+'/newLeader',{
            newLeader: host
        }).then((response) => {
            console.log(response.data.message);
        }).catch((error) => {
            console.log(error.code);
        });
    }
}


function reportLeader(url){
    listNodes.forEach(element => {
        if(element.url != url){
            axios.post(element.url+ '/reportLeader',{
                leader: url
            }).then((response) => {
                console.log(response.message);
            }).catch((error) => {
                console.log(error.code);
            })
        }
    });

    }
function getMaxNode(){
    var max = 0;
    listNodes.forEach(element => {
        if(max < element.value && element.url != leader){
            max = element.value;
        }
    });
    return max;
}

function timeRandom(){
    return Math.floor(Math.random() * (60000 - 10000) + 10000);
}
