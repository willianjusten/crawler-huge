#!/usr/bin/env node

// To prevent warning of memory leak
process.setMaxListeners(0);

"use strict";

const Crawler = require("simplecrawler");
const _ = require("lodash");
const fs = require("fs");
const program = require("commander");
const chalk = require("chalk");
const path = require("path");
const URL = require("url-parse");
const robotsParser = require("robots-parser");
const request = require("request");
const jsonfile = require("jsonfile");
const Pageres = require('pageres');

program.usage("[options] <url>")
        .option("-f, --folder [folder]", "specifies folder name")
        .parse(process.argv);

var crawlerHuge = function(url) {
    this.chunk = [];

    this.uri = new URL(url);
    this.crawler = new Crawler(this.uri.host);

    this.crawler.initialPath = "/";

    this.crawler.initialPort = 80;

    if (!this.uri.protocol) {
        this.uri.set("protocol", "http:");
    }

    this.crawler.initialProtocol = this.uri.protocol.replace(":", "");
    this.crawler.userAgent = "Node/Crawler-huge";
    this.crawler.stripQuerystring = true;

    var exclude = ["pdf", "gif", "jpg", "jpeg", "png", "ico", "bmp", "ogg", "webp", "mp4", "webm", "mp3", "ttf", "woff", "json", "rss", "atom", "gz", "zip", "rar", "7z", "css", "js", "gzip", "exe"];

    var exts = exclude.join("|");
    var regex = new RegExp("\.(" + exts + ")", "i");

    this.crawler.addFetchCondition(function(parsedURL) {
        return !parsedURL.path.match(regex);
    });

    request(this.uri.set("pathname", "/robots.txt").toString(), (error, response, body) => {
        if (!error && response.statusCode == 200) {
            this.robots = robotsParser(response.request.uri.href, body);
        }
        this.create();
    });
};

crawlerHuge.prototype.create = function() {

    this.crawler.on("fetchcomplete", (item) => {
        var allowed = true;
        var i = 0;

        if (this.robots) {
            try {
                allowed = this.robots.isAllowed(item.url, this.crawler.userAgent);
            } catch (e) {
                // silent error
            }
        }

        if (allowed) {

            this.chunk.push({
                'url': item.url
            });

            this.getScreenshots(item.url);

            console.log(chalk.cyan.bold("Url:"), chalk.gray(item.url));
        } else {
            console.log(chalk.bold.magenta("Ignored:"), chalk.gray(item.url));
        }
    });

    this.crawler.on("fetch404", function(item, response) {
        console.log(chalk.red.bold("404:"), chalk.gray(item.url));
    });

    this.crawler.on("fetcherror", function(item, response) {
        console.log(chalk.red.bold("Error:"), chalk.gray(item.url));
    });

    this.crawler.on("complete", () => {
        if (_.isEmpty(this.chunk)) {
            console.error(chalk.red.bold("Error: Site '%s' could not be found."), program.args[0]);
            process.exit(1);
        }

        this.write();

        console.log(chalk.red.bold("Found %s links!"), this.chunk.length );
    });

    this.crawler.start();
};

crawlerHuge.prototype.write = function() {
    var file = 'data/' + program.folder + '/links.json';
    jsonfile.writeFileSync(file, this.chunk, {spaces: 2})
};

crawlerHuge.prototype.getScreenshots = function(url) {
    var folder = program.folder || 'img';
    const pageres = new Pageres({delay: 2})
        .src(url, ['1024x768'])
        .dest(__dirname + '/data/' + folder)
        .run()
        .then(() => console.log(chalk.cyan.bold("Screenshot taken:"), chalk.gray(url)));
}

var generator = new crawlerHuge(program.args[0]);
