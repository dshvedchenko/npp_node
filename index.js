const WebSocket = require('ws');

var states = [];
var firstState = true;
var tryCount = 0;
var lever0PulledAfterFirstTry = false;

var socket = new WebSocket("ws://nuclear.t.javascript.ninja");

socket.onopen = function() {
    console.warn("NPP Connected ....");
};

socket.onclose = function(event) {
    if (event.wasClean) {
        console.warn('Disconnect cleanly');
    } else {
        console.error('NPP says rude goodbye');
    }
    console.error('Codd: ' + event.code + ' prichina : ' + event.reason);
};

socket.onmessage = function(event) {
    try {
        var data = JSON.parse(event.data);
        if (data.pulled !== undefined) {
            init(data);
        } else if (data.action !== undefined && data.action === 'check') {
            fillChecks(data);
        } else if (data.error !== undefined) {
            console.error(data.error);
            process.exit();
        } else if (data.newState !== undefined && data.newState === 'poweredOff') {
            console.log(data.token);
            process.exit();
        }
    } catch (err) {
        console.log(err);
        process.exit();
    }
    //states.forEach(i => console.log(i));
};

socket.onerror = function(error) {
    console.error("Ошибка " + error.message);
};

function KState(id, pId) {
    this.firstState = firstState;
    firstState = false;

    this.id = id;
    if (!this.firstState) {
        this.sames = [].slice.apply(states[this.id - 1].sames);
    } else {
        this.sames = [undefined, undefined, undefined];
    }

    this.cLever = pId;
}

KState.prototype = {
    setPairResult: function(pair, res) {
        this.sames[pair] = res;

        if (this.getPowerOffCheck()) {
            console.log('---------------------------------------------- ' + this.id);
            poweroff(this.id);
        }
    },
    invertResults: function() {
        this.sames = this.sames.map(r => r === undefined ? r : !r);
        if (tryCount === 1) {
            lever0PulledAfterFirstTry = !lever0PulledAfterFirstTry;
        }
    },
    isAllSame: function() {
        return this.sames.every(i => i === true)
    },
    invertSameForLever: function() {
        this.setPairResult(this.cLever - 1, !this.sames[this.cLever - 1])
    },
    getPowerOffCheck: function() {
        return this.isAllSame() && (tryCount === 0 || lever0PulledAfterFirstTry);
    }
};


function init(data) {
    states[data.stateId] = new KState(data.stateId, data.pulled);
    runChecks(states[data.stateId]);
}

function runChecks(ks) {
    if (ks.cLever === 0) {
        ks.invertResults();
        return;
    }

    if (ks.sames[ks.cLever - 1] === undefined) {
        var p = new Promise((resolve, reject) => {
            checkLeverSame(ks.id, 0, ks.cLever);
        });
    } else {
        ks.invertSameForLever();
    }

}

function checkLeverSame(stateId, lever1, lever2) {
    var mo = {
        action: "check",
        lever1: lever1,
        lever2: lever2,
        stateId: stateId
    };
    var msg = JSON.stringify(mo);
    socket.send(msg);
}

function poweroff(stateId) {

    if (tryCount > 1) throw new Error("overcome limit");
    tryCount++;

    var mo = {
        action: "powerOff",
        stateId: stateId
    };
    var msg = JSON.stringify(mo);
    socket.send(msg);
}

function fillChecks(data) {
    var ks = states[data.stateId];
    if (ks !== undefined) {
        ks.setPairResult(data.lever2 - 1, data.same);
    }
}