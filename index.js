/*jslint node: true, esversion: 6 */
'use strict';

const app = require("express")();
const path = require("path");
const bodyParser = require('body-parser');
const convert = require('./app/converter').convert;

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
}));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/convert", (req, res) => {
    convert(req.body.input)
    .then(output => {
        res.json({
            output: output
        });
    })
    .catch(err => {
        console.log(err);
        res.json({ output: err.toString() });
    });
});

app.listen(5055, () => {
    console.log("Server running on http://localhost:5055");
});