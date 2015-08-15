var gulp = require('gulp');
var uglify = require('gulp-uglify');
var header = require('gulp-header');
var size = require('gulp-size');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var fs = require('fs');

var pkg = require('./package.json');
pkg.year = new Date().getFullYear();

var banner = '// <%= pkg.name %> v<%= pkg.version %> - <%= pkg.description %>\n' +
    '// Copyright (c) <%= pkg.year %> <%= pkg.author.name %> - <%= pkg.homepage %>\n' +
    '// License: <%= pkg.licenses[0].type %> - <%= pkg.licenses[0].url %>\n';

var tilt = fs.readFileSync('./src/tilt.js', 'utf8');

gulp.task('lib',function() {

    return gulp.src('./src/*.js')
        .pipe(replace('/* TILT */',tilt))
        .pipe(uglify())
        .pipe(header(banner,{pkg:pkg}))
        .pipe(size({
            'showFiles':true,
            'gzip':true
        }))
        .pipe(gulp.dest('./dist'));

});

gulp.task('sass',function(){

    return gulp.src('styles.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('./'));

});

gulp.task('dev',['lib'],function() {

    gulp.watch(['./src/*.js'],['lib']);

    gulp.watch(['./*.scss'],['sass']);

});