var httpinvoke = require('httpinvoke');
var htmlparser2 = require('htmlparser2');
var a = require('async');
var path = require('path');
var fs = require('fs');
var FeedHandler = require('./FeedHandler');

var albumkit = function(command) {
    if(command === 'download') {
        albumkit.download({
            url: arguments[1],
            dir: arguments[2],
            onprogress: function(name, progress) {
                if(name === 'begin-album') {
                    console.log('Downloading a full album from ' + progress.url + ' to ' + progress.dir + '.');
                } else if(name === 'end-photo') {
                    console.log('Downloaded photo ' + progress.name + ' (' + progress.current + ' of ' + progress.total + ').');
                }
            }
        }, function(err) {
            if(err) {
                return console.log(err);
            }
            console.log('Done.');
        });
    } else {
        console.log('Error: unknown command "' + command + '".');
        console.log('Reference of commands and their arguments:');
        console.log();
        console.log('    download url dir     dir is the destination directory and url must be an RSS feed, for example http://picasaweb.google.com/data/feed/api/user/USER_NAME_OR_ID/album/ALBUM_NAME?authuser=0&authkey=AUTHORIZATION_KEY_IF_NECESSARY&feat=directlink&imgmax=d');
        process.exit(1);
    }
};

albumkit.download = function(options, cb) {
    if(!options.url) {
        return cb(new Error('URL not given'));
    }
    if(!options.dir) {
        return cb(new Error('dir not given'));
    }
    if(!fs.existsSync(options.dir)) {
        return cb(new Error('directory ' + options.dir + ' does not exist'));
    }
    if(options.onprogress) {
        options.onprogress('begin-album', options);
    }
    httpinvoke(options.url, function(err, feed) {
        var handler, total, current;

        if(err) {
            return cb(err);
        }

        if(options.onprogress) {
            options.onprogress('parse-album');
        }
        try {
            handler = new FeedHandler();
            new htmlparser2.Parser(handler).end(feed);
        } catch(err) {
            return cb(err);
        }
        total = handler.dom.items.length;
        current = 0;
        a.each(handler.dom.items, function(item, cb) {
            if(options.onprogress) {
                options.onprogress('download-photo', {
                    name: item.title,
                    current: current,
                    total: total
                });
            }
            httpinvoke(item.content, {
                downloading: function(currentb, totalb) {
                    if(options.onprogress) {
                        options.onprogress('downloading-photo', {
                            name: item.title,
                            current: current,
                            total: total,
                            current_bytes: currentb,
                            total_bytes: totalb
                        });
                    }
                },
                outputType: 'bytearray'
            }, function(err, out) {
                if(err) {
                    return cb(err);
                }
                if(options.onprogress) {
                    options.onprogress('write-photo', {
                        name: item.title,
                        current: current,
                        total: total
                    });
                }
                fs.writeFile(options.dir + '/' + path.basename(item.content), out, function(err) {
                    if(err) {
                        return cb(err);
                    }
                    current += 1;
                    if(options.onprogress) {
                        options.onprogress('end-photo', {
                            name: item.title,
                            current: current,
                            total: total
                        });
                    }
                    cb();
                });
            });
        }, function(err) {
            if(err) {
                return cb(err);
            }
            if(options.onprogress) {
                options.onprogress('end-album', options);
            }
            cb();
        });
    });
};

module.exports = albumkit;
