// NOTE: I previously suggested doing this through Grunt, but had plenty of problems with
// my set up. Grunt did some weird things with scope, and I ended up using nodemon. This
// setup is now using Gulp. It works exactly how I expect it to and is WAY more concise.
var gulp = require('gulp'),
    concat = require('gulp-concat'),
    spawn = require('child_process').spawn,
    node;
 
gulp.task('concat', function() {
  return gulp.src([
    './sox/lib/extlibs/soxDeps.js'
    ,'./sox/lib/extlibs/sox.strophe.pubsub.js'
    ,'./sox/lib/extlibs/strophe.x.js'
    ,'./sox/lib/sox/SoxClient.js'
    ,'./sox/lib/sox/SoxEventListener.js'
    ,'./sox/lib/sox/Device.js'
    ,'./sox/lib/sox/Transducer.js'
    ,'./sox/lib/sox/SensorData.js'
    ,'./sox/lib/extlibs/soxDepsPostfix.js'
    ])
    .pipe(concat('soxLib.js'))
    .pipe(gulp.dest('./sox/lib/'));
})

gulp.task('sox', function() {
  if (node) node.kill();
  node = spawn('node', ['sox.js'], {stdio: 'inherit'});
  node.on('close', function (code) {
    if (code === 8) {
      gulp.log('Error detected, waiting for changes...');
    }
  });
})

gulp.task('watch', function(){
  gulp.watch(['./sox.js', './lib/**/*.js', './js/**/*.js'], ['sox'])
})
 
/**
 * $ gulp
 * description: start the development environment
 */
gulp.task('default', ['sox','watch'])
 
// clean up if an error goes unhandled.
process.on('exit', function() {
    if (node) node.kill()
})