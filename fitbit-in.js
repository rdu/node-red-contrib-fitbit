const moment = require('moment');

function typedDataFactory(RED, config, node) {
    return function getTypedInput(msg, key) {
        const type = key + 'Type';

        switch (config[type]) {
            case 'str':
                return config[key];
            case 'date':
                return new Date();
            case 'msg':
                return RED.util.getObjectProperty(msg, config[key]);
            case 'flow':
                return node.context().flow.get(config[key]);
            case 'global':
                return node.context().global.get(config[key]);

            default:
                break;
        }
    }
}

module.exports = function (RED) {
    const oauth = require('./oauth-helper')(RED);

    const RESOURCE_TYPES = {
        "body-fat-log": {
            display: RED._("fitbit.resources.body-fat-log"),
            inputs: ["startDate", "endDate", "period"],
            func: (data) => {
                if (!data.startDate) {
                    throw "Startdate is required.";
                }

                const formattedStartDate = moment(data.startDate).format('YYYY-MM-DD');

                if (data.startDate && !data.endDate && !data.period) {
                    return "https://api.fitbit.com/1/user/-/body/log/fat/date/" + formattedStartDate + ".json";
                } else if (data.startDate && data.endDate && !data.period) {
                    const formattedEndDate = moment(data.endDate).format('YYYY-MM-DD');
                    return "https://api.fitbit.com/1/user/-/body/log/fat/date/" + formattedStartDate + "/" + formattedEndDate + ".json";
                } else if (data.startDate && !data.endDate && data.period) {
                    if (!['1d', '7d', '1w', '1m'].includes(data.period)) throw "Invalid period";

                    return "https://api.fitbit.com/1/user/-/body/log/fat/date/" + formattedStartDate + "/" + data.period + ".json";
                } else {
                    throw "Bad input combination";
                }
            }
        }
    };

    function fitbitInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const getTypedData = typedDataFactory(RED, config, node);

        if (!RED.nodes.getNode(config.fitbit)) {
            this.warn(RED._("fitbit.warn.missing-credentials"));
            return;
        }

        if (!config.resource) {
            this.warn(RED._("fitbit.warn.missing-resource"));
            return;
        }

        const resource = RESOURCE_TYPES[config.resource];

        node.on('input', function (msg) {
            let url;
            try {
                const data = resource.inputs.map((input) => {
                    return getTypedData(msg, input.key);
                })

                url = resourceFunc(data);
            } catch (err) {
                node.error(err, msg);
                return;
            }

            if (!url) {
                node.error("Could not build api url", msg);
                return;
            }

            const credentialsNode = RED.nodes.getNode(config.fitbit);
            const credentials = RED.nodes.getNode(config.fitbit).credentials;

            oauth.makeRequest("GET", url, credentials, credentialsNode.id).then(data => {
                msg.payload = data;
                node.send(msg);
            })
        });
    }
    RED.nodes.registerType("fitbit-in", fitbitInNode);


    RED.httpAdmin.get('/fitbit-in/resources', function (req, res) {
        res.send(RESOURCE_TYPES);
    });
}