"use strict";

function configure(packageFolder, packageName)
{
  if (about.isPaintMode())
    return;

  //---------------------------
  //Create Shortcuts
  ScriptManager.addShortcut( { id       : "ShotgunShortcut",
                               text     : "Shotgun Menu ...",
                               action   : "ShotgunMenu in ./configure.js",
                               longDesc : "Starts the shotgun connection",
                               order    : "256",
                               categoryId   : "Shotgun", 
                               categoryText : "Scripts" } );
  
  //---------------------------
  //Create Menu items
  ScriptManager.addMenuItem( { targetMenuId : "Windows",
                               id           : "ShotgunMenuID",
                               icon     : "shotgun.png",
                               text         : "Shotgun Menu ...",
                               action       : "ShotgunMenu in ./configure.js",
                               shortcut     : "ShotgunShortcut" } );

  //---------------------------
  //Create Toolbar
  var ShotgunToolbar = new ScriptToolbarDef( { id          : "ShotgunToolbar",
                                               text        : "Shotgun",
                                               customizable: "false" } );
  
  ShotgunToolbar.addButton( { text     : "Shotgun",
                              icon     : "shotgun.png",
                              action   : "ShotgunMenu in ./configure.js" ,
                              shortcut : "ShotgunShortcut" } );

  ScriptManager.addToolbar(ShotgunToolbar);
  init();
}

// -----------------------------------------------------------------------------
// Misc utilities
// -----------------------------------------------------------------------------
var META_SHOTGUN_PATH = "meta.shotgun.path";

function singleShotTimer(msec, callback)
{
    var t = new QTimer;
    t.changeInterval(msec);

    function on_elapsed_time()
    {
        this.stop();
        callback();
    }

    t.timeout.connect(t, on_elapsed_time);
    t.start();
}

// -----------------------------------------------------------------------------
// Import/Reference resource methods
// -----------------------------------------------------------------------------

/*
Used to import resources into the scene.
Note that most of these methods are extracted from the example scripts.
*/

var PNGTransparencyMode = 0; //Premultiplied wih Black
var TGATransparencyMode = 0; //Premultiplied wih Black
var SGITransparencyMode = 0; //Premultiplied wih Black
var LayeredPSDTransparencyMode = 1; //Straight
var FlatPSDTransparencyMode = 2; //Premultiplied wih White


/* extract basename. Given a long filename with path and extension,
  return the name of the file without extension
   ie.  /Users/mbegin/MyFiles/image.png" ===> image
*/
function basename( filename )
{
  var pos = filename.lastIndexOf( ".");
  if( pos >= 0 )
    filename = filename.substr(0,pos);
  var name = filename.split("/");
  if( name.length > 0 )
    name = name[ name.length-1];
  return  name;
}


function getUniqueColumnName( column_prefix )
{
  var suffix = 0;
  // finds if unique name for a column
  var column_name = column_prefix;
  while(suffix < 2000)
  {
      if(!column.type(column_name))
          break;

      suffix = suffix + 1;
      column_name = column_prefix + "_" + suffix;
  }
  return column_name;
}

function copyFile( srcFilename, dstFilename )
{
  var srcFile = new PermanentFile(srcFilename);
  var dstFile = new PermanentFile(dstFilename);
  srcFile.copy(dstFile);
}

/*
  given a file (ie. a png, tga,tvg, 3d,...), create a new read module, column and element of the
  right type and put the file within

  @returns the name of the read created so that it can be connected to the graph.
*/
function dropFileInNewElement( root, filename, transparency, alignmentRule)
{
  var vectorFormat = null;
  var extension = null;

  var pos = filename.lastIndexOf( "." );
  if( pos < 0 )
    return null;

  extension = filename.substr(pos+1).toLowerCase();

  if( extension == "jpeg" )
    extension = "jpg";
  if(  extension == "tvg" )
  {
    vectorFormat = "TVG"
    extension ="SCAN"; // element.add() will use this.
  }

  var name = basename(filename);
  var elemId = element.add(name, "BW", scene.numberOfUnitsZ(), extension.toUpperCase(), vectorFormat);
  if ( elemId == -1 )
  {
    // hum, unknown file type most likely -- let's skip it.
    return null; // no read to add.
  }

  var uniqueColumnName = getUniqueColumnName(name);
  column.add(uniqueColumnName , "DRAWING");
  column.setElementIdOfDrawing( uniqueColumnName, elemId );

  var read = node.add(root, name, "READ", 0, 0, 0);
  var transparencyAttr = node.getAttr(read, frame.current(), "READ_TRANSPARENCY");
  var opacityAttr = node.getAttr(read, frame.current(), "OPACITY");
  transparencyAttr.setValue(true);
  opacityAttr.setValue(transparency);

  var alignmentAttr = node.getAttr(read, frame.current(), "ALIGNMENT_RULE");
  alignmentAttr.setValue(alignmentRule);

  var transparencyModeAttr = node.getAttr(read, frame.current(), "applyMatteToColor");
  if (extension == "png")
    transparencyModeAttr.setValue(PNGTransparencyMode);
  if (extension == "tga")
    transparencyModeAttr.setValue(TGATransparencyMode);
  if (extension == "sgi")
    transparencyModeAttr.setValue(SGITransparencyMode);
  if (extension == "psd")
    transparencyModeAttr.setValue(FlatPSDTransparencyMode);

  node.linkAttr(read, "DRAWING.ELEMENT", uniqueColumnName);

  var timing = "1"; // we're creating drawing name '1'

  Drawing.create(elemId, timing, true); // create a drawing drawing, 'true' indicate that the file exists.
  var drawingFilePath = Drawing.filename(elemId, timing);   // get the actual path, in tmp folder.
  copyFile( filename, drawingFilePath );

  //set exposure of all frames.
  var nframes = frame.numberOf();
  for( var i =1; i <= nframes; ++i)
  {
    column.setEntry(uniqueColumnName, 1, i, timing );
  }

  return read; // name of the new drawing layer.
}

function dropMovieInNewElement( root, filename, transparency, alignmentRule, progress_callback)
{
  var vectorFormat = null;
  var extension = "png";
  if (typeof(progress_callback) == "undefined")
    progress_callback = MessageLog.trace;

  var pos = filename.lastIndexOf( "." );
  if( pos < 0 )
    return null;

  var name = basename(filename);
  var elemId = element.add(name, "COLOR", scene.numberOfUnitsZ(), extension.toUpperCase(), 0);
  if ( elemId == -1 )
  {
    // hum, unknown file type most likely -- let's skip it.
    return null; // no read to add.
  }

  var message = "Importing:\n\t" + name+"\n"; 
  progress_callback(message);

  var uniqueColumnName = getUniqueColumnName(name);
  column.add(uniqueColumnName , "DRAWING");
  column.setElementIdOfDrawing( uniqueColumnName, elemId );

  var read = node.add(root, name, "READ", 0, 0, 0);
  var transparencyAttr = node.getAttr(read, frame.current(), "READ_TRANSPARENCY");
  var opacityAttr = node.getAttr(read, frame.current(), "OPACITY");
  transparencyAttr.setValue(true);
  //opacityAttr.setValue(transparency);

  var alignmentAttr = node.getAttr(read, frame.current(), "ALIGNMENT_RULE");
  //alignmentAttr.setValue(alignmentRule);

  var transparencyModeAttr = node.getAttr(read, frame.current(), "applyMatteToColor");
  if (extension == "png")
      transparencyModeAttr.setValue(PNGTransparencyMode);

  node.linkAttr(read, "DRAWING.ELEMENT", uniqueColumnName);

  var image_folder = specialFolders.temp + "/" + column.generateAnonymousName()+"/";
  var dir = new Dir;
  dir.path = image_folder
  dir.mkdirs();

  message += "\nConverting movie into images....\n\n";
  progress_callback(message);

  MovieImport.setMovieFilename(filename)
  MovieImport.setImageFolder(image_folder)
  MovieImport.setImagePrefix(name) 
  MovieImport.setAudioFile(image_folder + "/" + name + ".wav");

  MovieImport.doImport();
  
  var image_count = MovieImport.numberOfImages();

  for (var i = 1; i <= image_count; i++)
  {
      var message = "Importing:\n\t" + name + "\n"; 
      message += "\nCreating drawings " + i.toString() + " of " + image_count.toString()+"\n\n";
      progress_callback(message);

    var timing = i.toString();
    // unfortunately MovieImport.image(i) does not work as it gives us
    // the images in the wrong order. luckily we can recreate the filename
    // easily... 
    var image_path = image_folder + name + "-"+timing+".png"; 
    Drawing.create(elemId, timing, true); // create a drawing drawing, 'true' indicate that the file exists.
    var drawingFilePath = Drawing.filename(elemId, timing);   // get the actual path, in tmp folder.

    copyFile( image_path, drawingFilePath );
    column.setEntry(uniqueColumnName, 1, i, timing );
  }

  var message = "Importing:\n\t" + name + "\n"; 
  message += "\nDone.\n\n";
  // last one with a timer to close the show busy dialog automatically
  progress_callback(message, 3000); 
  return read; // name of the new drawing layer.
}

// helper function to get the engine if it is ready to use
function _get_engine()
{
    var app = QCoreApplication.instance();
    var engine = app.shotgun_engine;

    if (engine != null && engine.is_engine_ready)
        return engine;
}

function import_image(filename, parent)
{
  if (parent === undefined)
    parent = node.root();

  var transparency = null;
  var alignmentRule = null
  var read_node = dropFileInNewElement(parent, filename, transparency, alignmentRule);
  return read_node;
}

function import_sound(filename)
{
    var column_name = getUniqueColumnName(basename(filename));
    var frame = Timeline.firstFrameSel;
    column.add(column_name, "SOUND");
    result = column.importSound(column_name, frame, filename);

    // unfortunately there is no way to attach metadata to sound columns
    // so we do it at scene level. This will break easily if the column is 
    // renamed in anyway!
    setSceneMetadata(column_name +"." + META_SHOTGUN_PATH, filename);
    
    return result;
}

function import_movie(filename, parent)
{
  if (parent === undefined)
    parent = node.root();

  var transparency = null;
  var alignmentRule = null
  var engine = _get_engine();

  // since it takes a bit of time to import a movie
  // let's show a dialog to the user to let them know.
  function progress_callback(message, close_on_elapsed_time)
  {
    if (engine != null)
    {
        engine.show_busy("Importing Movie...", message, close_on_elapsed_time);
        System.processOneEvent();
    }
  }

  if (engine != null)
    engine.clear_busy();
  
  var read_node = dropMovieInNewElement(parent, filename, transparency, alignmentRule, progress_callback);

  return read_node;
}


// -----------------------------------------------------------------------------
// Meta Data related functions
//
// Since 'scene' functions had metadata scripting methods, I was looking for the 
// equivalent in the node functions with no luck.
// Fairly obscure from Harmony, the metadata editor GUI is not more than a 
// node property editor that add/modifies the property 'meta' in a given node.
//
// Note that we store all our shotgun metadata under meta.shotgun property. 
// -----------------------------------------------------------------------------


function setSceneMetadata(attrName, value)
{
    scene.setMetadata({ "name":attrName, "type": "string", "value": value });
}

function getSceneMetadata(attrName)
{
    var meta = scene.metadata(attrName);
    return meta && meta.value ? meta.value : "";
}

function removeSceneMetadata(attrName)
{
    scene.setMetadata({ "name":attrName, "type": "string", "value": "" });
}

function getNodeMetadata(nodeName, attrName)
{
    return node.getTextAttr(nodeName, 1, attrName);
}

function setNodeMetadata(nodeName, attrName, value)
{
    var visualAttrName = attrName;
    var idx = attrName.lastIndexOf(".");
    if (idx >= 0)
    {
      visualAttrName = attrName.substr(idx + 1);
    }

    var attr = node.getAttr(nodeName, 1.0, attrName);
    if(attr.keyword() == "")
    {
        if (node.createDynamicAttr(nodeName, "STRING", attrName, visualAttrName, false))
        {
          attr = node.getAttr(nodeName, 1.0, attrName);
        }

        if (attr.keyword() != "")
        {
            node.setTextAttr(nodeName, attrName, 1.0, value || visualAttrName);
        }
    }
    else
    {
        node.setTextAttr(nodeName, attrName, 1.0, value || visualAttrName);
    }
}

function removeNodeMetadata(nodeName, attrName)
{
    node.removeDynamicAttr(nodeName, attrName);
}

function renameNodeMetadata(nodeName, oldName, newName)
{
    var value = getNodeMetadata(nodeName, oldName);
    setNodeMetadata(nodeName, newName, value);
    removeNodeMetadata(nodeName, oldName);
}

// -----------------------------------------------------------------------------
// Engine related classes, methods
// -----------------------------------------------------------------------------

this.debug = true;

function log_debug(data)
{
    message = typeof(data.message) != "undefined" ? data.message : data; 

    if (this.debug)
        MessageLog.trace("(DEBUG) Shotgun bridge: " + message.toString());
}


function log_info(data)
{
    message = typeof(data.message) != "undefined" ? data.message : data; 
    MessageLog.trace("(INFO) Shotgun bridge: " + message.toString());    
}


function log_warning(data)
{
    message = typeof(data.message) != "undefined" ? data.message : data; 
    MessageLog.trace("(WARNING) Shotgun bridge: " + message.toString());
}


function log_error(data)
{
    message = typeof(data.message) != "undefined" ? data.message : data; 
    MessageLog.trace("(ERROR) Shotgun bridge: " + message.toString());
}


function log_exception(data)
{
    message = typeof(data.message) != "undefined" ? data.message : data; 
    MessageLog.trace("(EXCEPTION) Shotgun bridge: " + message.toString());
}


function find_widgets(node, node_name, node_text, stop_if_found,  level, result)
{
    if (typeof(level) === typeof(undefined))
    {
        level = 0;
    }

    if (typeof(stop_if_found) === typeof(undefined))
    {
        stop_if_found = false;
    }

    if (typeof(result) === typeof(undefined))
    {
        result = [ ];
    }

    if (node.objectName == node_name)
    {
        result.push(node);
        if (stop_if_found)
            return result;
    }

    if (node_text && node.text && node.text.toString().indexOf(node_text)>-1)
    {
        result.push(node);
        if (stop_if_found)
            return result;
    }

    for (i in node.children())
    {
        find_widgets(node.children()[i], node_name, node_text, stop_if_found,  level+1, result);
    } 
    return result;
}


function ask_question(title, message, default_option)
{
    var msgBox = new QMessageBox();
    msgBox.setWindowTitle(title);
    msgBox.text = message;
    msgBox.addButton(QMessageBox.Yes);
    msgBox.addButton(QMessageBox.No);

    if (default_option === undefined)
        default_option = QMessageBox.Yes;

    msgBox.setDefaultButton(default_option);
    return msgBox.exec();
}


function Server(host, port) 
{
    var self = this;
    self.name = "Server"
    self.socket = new QTcpServer(this);
    self.host = new QHostAddress(host);
    self.port = port;
    self.active = false;
    self.connection = null;
    self._block_size = 0;
    self.INT32_SIZE = 4;
    self.MAX_READ_RESPONSE_TIME = 5000;
    
    self.log_debug = log_debug;
    self.log_info = log_info;
    self.log_warning = log_warning;
    self.log_error = log_error;
    self.log_exception = log_exception;
    self.debug = true;
    
    // rpc-ish
    self.m_id = 0;
    self._callbacks = null;
    self._responses = {}

    self.start = function()
    {
        self.active = false;
        self.connection = null;
        self._block_size = 0;
        self.register_command("DIR", self.list_methods);

        if (self.socket.listen(self.host, self.port))
        {
            self.log_debug("Local Server started: " + self.host.toString() + ":" + self.port);
            self.active  = true;
            self.socket.newConnection.connect(self, self.on_new_connection);
            return true;
        }
        else
        {
            self.active = false;
            self.log_error("Local Server could not start! " + self.host.toString() + ":" + self.port);
            return false;
        }
    }

    self.close = function()
    {
        self.active = false;
        self.socket.close()
    }

    self.list_methods = function()
    {
        var commands = [];

        for (var command in self._callbacks)
            commands.push(command);

        return commands;
    }

    self.register_command = function(command, callback)
    {
      if (self._callbacks === null) 
        self._callbacks = {};

      //MessageLog.trace("Registered command: " + command)
      self._callbacks[command] = callback;
    }

    self._send = function(command)
    {
        if (self.socket && self.connection)
        {
            self.log_debug("Connection status: " + self.connection.state() );
            self.log_debug("Connection valid: " + self.connection.isValid() );


            command = command.toString();

            var data = new QByteArray();

            outstr = new QDataStream(data, QIODevice.WriteOnly);
            outstr.setVersion(QDataStream.Qt_4_6);
            outstr.writeInt(0);

            data.append(command);

            outstr.device().seek(0);
            outstr.writeInt(data.size() - 4);

            var written = self.connection.write(data);
            self.log_debug("Written len: " + written );
        }
        else
        {
            self.log_debug("No connection, message lost!: " + command );
        }
    }


    self._receive = function()
    {
        self.log_debug("Receiving data ... ");

        var stream = new QDataStream();
        stream.setDevice(self.connection);
        stream.setVersion(QDataStream.Qt_4_6);

        self.log_debug("self.connection.bytesAvailable() ... " + self.connection.bytesAvailable());
        var i = 0;
        while (self.connection.bytesAvailable() > 0)
        {
            self.log_debug("Request number: " + i);

            if ( (self._block_size == 0 && self.connection.bytesAvailable() >= self.INT32_SIZE) || (self._block_size > 0 && self.connection.bytesAvailable() >= self._block_size) )
            {
                self._block_size = stream.readInt();
                self.log_debug("Request number: " + i + " | block size: " + self._block_size);
            }

            if (self._block_size > 0 && self.connection.bytesAvailable() >= self._block_size)
            {
                var data = self.connection.read(self._block_size);
                
                // create the request
                var request = "";
                for ( var j = 0; j < data.size(); j++)
                {
                    if (data.at(j) >0 )
                    {
                        request = request.concat(String.fromCharCode(data.at(j)));
                    }
                }
                self.log_debug("Request number: " + i + " | About to process | Request: " + request)
                self._process_request(request) // #, caller_request_id=request_id)
                self._block_size = 0; 
                i+=1;
            }
        }
    }

    self._prepare_request = function(command, data, request_return)
    {
        self.m_id += 1;
        request_id = self.m_id;
        var request = {"jsonrpc": "2.0",
                        "method": command,
                        "params": data,
                        "request_return": request_return,
                        "id": request_id};
        var request = JSON.stringify(request);
        return request;
    }

    self._prepare_reply = function(request_id, result)
    {
        var request = {"jsonrpc": "2.0",
                        "result": result,
                        "request_return": false,
                        "id": request_id};
        var reply = JSON.stringify(request);
        return reply;
    }

    self._prepare_error = function(request_id, error)
    {
        var request = {"jsonrpc": "2.0",
                        "error": error || null,
                        "id": request_id};
        var error_reply = JSON.stringify(request);
        return error_reply;
    }

    self._process_request = function(request)
    {
        var command;
        self.log_info("_process_request | Request: " + request);

        // check is well formed json request
        try
        {
            command = JSON.parse(request);
        }
        catch(err)
        {
            self.log_warning("Ignoring request, not well formed.  | Request: " + request);
            return;
        }

        // check there is a request id
        var request_id = command.id
        if (request_id == null)
        {
            self.log_warning("Ignoring request, not well formed.  | Request: " + request);
            return;
        }

        // a function call
        if (command.method != null)
        {
            self.log_debug("A function call. " + request);
            var method = command.method.toUpperCase(); 
            var params = command.params;
            var return_requested = command.request_return;

            self.log_debug("Command method : " + method);
            self.log_debug("Command return requested : " + (return_requested == true));
            self.log_debug("Command method recognised: " + (method in self._callbacks));

            if (self._callbacks && method in self._callbacks)
            {
                try 
                {
                   var result = self._callbacks[method](params);
                   if (return_requested == true)
                        self.send_reply(request_id, result);
                }
                catch(err)
                {
                   self.log_error("An error ocurred executing callback for method: " + method + " and params: " + params);
                   self.log_error(err.message);
                }
            }
            else
            {
                self.log_warning("Command received was ignored: " + command);
            }
        }
        // a result that we requested
        else if (command.result != null)
        {
            self.log_debug("This was a result | Result: " + request);
            self._responses[request_id] = command.result;
            //return command.result;
        }
        // an error that happened on the client side
        else if (command.error != null)
        {
            self.log_error("Error occurred when requesting command. " + command.error);
        }
    }

    self.send_and_receive_command = function(method, data)
    {
        // request for a return value
        var request = self._prepare_request(method, data, true);
        var request_id = request.id; 

        var st = new QTime();
        st.start();

        self._send(request);
        self.log_debug("Sent request in " + st.elapsed() + " secs | Request: " + request);

        // receive
        self.log_debug("Waiting to receive data...");

        var result = null;
        var st_response = new QTime();
        st_response.start();

        self.connection.waitForReadyRead(self.MAX_READ_RESPONSE_TIME);
        while (true)
        {
            System.processOneEvent();
            if (request_id in self._responses)
            {
                result = self._responses[request_id];
                self.log_debug("Received command result in " + st_response.elapsed() + " secs | Request ID: " + request_id + " | Result: " + result);
                break;
            }

            logger.debug("st_response_elapsed " + st_response.elapsed() + " secs | max : " + (self.MAX_READ_RESPONSE_TIME/1000) + " | responses : " + self._responses);
            if (st_response_elapsed > self.MAX_READ_RESPONSE_TIME/1000)
            {
                self.log_debug("Did not Received command result in " + st_response.elapsed() + " secs | Request ID: " + request_id + " | Responses: " + self._responses);
                break;
            }
        }

        self.log_debug("Done send and receive in " + st.elapsed() + " secs.");
        return result;
    }

    self.send_command = function(command, data)
    {
        var request = self._prepare_request(command, data)
        self.log_debug("Command sent: " + request);
        self._send(request)
    }

    self.send_reply = function(request_id, result)
    {
        try 
        {
            var reply = self._prepare_reply(request_id, result)
            MessageLog.trace("(DEBUG) Sending Response:" + reply);
            self._send(reply);
        }
        catch(err) 
        {
            var reply = self._prepare_error(request_id, err)
            self.log_error("Unexpected error while sending " + err.message + " message id: " + message_id);
            self._send(reply);
        }
    }

    self.on_connection_error = function(socket_error)
    {
        self.log_error("Connection error happened. " + socket_error.toString());
    }

    self.on_connection_disconnected = function(socket_error)
    {
        self.log_debug("Client disconnected.");
        self.connection = null;

    }

    self.on_new_connection = function()
    {
        self.log_debug("New connection detected:");
        if (self.socket.hasPendingConnections())
        {
            self.connection = self.socket.nextPendingConnection();

            var state = self.connection.state();

            self.connection.readyRead.connect(self, self._receive);
            self.connection.error.connect(self, self.on_connection_error);
            self.connection.disconnected.connect(self, self.on_connection_disconnected);

            self.log_debug("Connection state: " + state);
            self.log_debug("Client connected: " + self.connection.toString());

            self.send_and_receive_command("PING", {});
        }
        else
        {
            self.log_debug("-----------------------------------------------------------------------------");
            self.log_debug("No pending connections!: %s" % self.connection.toString());
        }
    }
}



var app = QCoreApplication.instance();

function Engine()
{
    var self = this;
    self.app = QCoreApplication.instance();
    self.name = "Shotgun Engine"
    self.window = QApplication.activeWindow();
    self.server = null;
    self.log_debug = log_debug;
    self.log_info = log_info;
    self.log_warning = log_warning;
    self.log_error = log_error;
    self.log_exception = log_exception;
    self.debug = true;
    self.is_engine_ready = false;
    self.on_engine_ready_callbacks = [];

    // ------------------------------------------------------------------------
    // Local Engine methods
    // ------------------------------------------------------------------------

    self._create_busy_dialog = function()
    {
        var resources_path = System.getenv("SGTK_HARMONY_ENGINE_RESOURCES_PATH");
        var ui_file = resources_path + "/ui/busy_dialog.ui";
        var icon_file = resources_path + "/ui/sg_logo_80px.png";
        var ui = UiLoader.load(ui_file);
        ui.windowTitle = "Shotgun Harmony Engine";
        
        var icon_widget = ui.frame.horizontalLayout.itemAt(0).widget();
        icon_widget.icon = icon_file ;

        var title_widget = ui.frame.horizontalLayout.verticalLayout.itemAt(0).widget();
        var details_widget = ui.frame.horizontalLayout.verticalLayout.itemAt(1).widget();
        
        icon_widget.text = "<html><img src='" + icon_file + "'></html>";
        title_widget.text = "";
        details_widget.text = "";
        return ui;
    }

    self.show_busy_dialog = self._create_busy_dialog(); //null;

    self.show_busy = function(title, message, close_on_elapsed_time)
    {
        if (self.show_busy_dialog == null)
            self.show_busy_dialog = self._create_busy_dialog();

        var ui = self.show_busy_dialog;
        var title_widget = ui.frame.horizontalLayout.verticalLayout.itemAt(0).widget();
        var details_widget = ui.frame.horizontalLayout.verticalLayout.itemAt(1).widget();
        title_widget.text = title;
        details_widget.text = message;
        ui.show();
        
        if (typeof close_on_elapsed_time != "undefined")
        {
            singleShotTimer(close_on_elapsed_time, ui.hide)
        }
    }

    self.clear_busy = function()
    {
        if (self.show_busy_dialog != null)
            self.show_busy_dialog.hide();

        //self.show_busy_dialog = null;
    }

    self.set_main_window = function(widget)
    {
        self.window = widget;
    }

    // ------------------------------------------------------------------------
    // Harmony Scene operations
    // ------------------------------------------------------------------------
    self.extract_thumbnail = function ()
    {
        if (self.window != null)
        {
            // get a random path for the thumbnail
            f = new TemporaryFile( "png" );
            filename = f.path();
            f.close();
    
            var result = find_widgets(self.window, "ContainGLWidget", true);
            var p = QPixmap.grabWindow(result[0].winId());
            p.save(filename, "png");
            return filename;
        }
        return "";
    }

    self.get_version = function(data) 
    {
        var regex = /.* (\d+\.\d+\.\d+) .*/gm;
        var version_info = about.getVersionInfoStr ();
        var version_re = regex.exec(version_info);

        return version_re[1];
    }
    
    self.engine_restart = function(data)
    {
        // the python engine is about to be restarted , so make sure the
        // Harmony engine is marked as not finished loading.
        self.is_engine_ready = false;
    }

    self.engine_ready = function(data)
    {
        MessageLog.trace("Engine is operational, we can ask for it's menu now!")
        self.is_engine_ready = true;
        for (var i in self.on_engine_ready_callbacks)
            self.on_engine_ready_callbacks[i]();
    }

    self.execute_statement = function(data)
    {
        try
        {
          scene.beginUndoRedoAccum("Execute Statement");
          var result = eval(data.statement);
          scene.endUndoRedoAccum();
          return result;
        }
        catch (err)
        {
          self.log_exception(err)
          return false;
        }
        return false;
    }
    
    self.toggle_debug_logging = function(data)
    {
        self.debug = data.enabled;
    }
    
    self.current_project_path = function(data)
    {
        return scene.currentProjectPath() +"/" + scene.currentVersionName() + ".xstage";
    }
    
    self.current_project_folder = function(data)
    {
        return scene.currentProjectPath();
    }
    
    self.open_project = function(data)
    {
        var path = data.path;
        MessageLog.trace("SceneOperations: open - Action");
        self.window.requestOpenScene(path);
        self.refresh_title();
        return scene.currentProjectPath();
    }
    
    self.save_project = function (data)
    {
        var result = scene.saveAll();
        self.refresh_title();
        return scene.currentProjectPath();
    }
    
    self.save_new_version_action = function(data)
    {
        Action.perform("onActionSaveAsScene");
    }

    self.save_new_version =function (data)
    {
        var version_name = data.version_name;
        MessageLog.trace("SceneOperations: save_new_version - Action");
        MessageLog.trace("SceneOperations: save_new_version - version_name : " + version_name);

        var result = scene.saveAsNewVersion(version_name, true);
        result = scene.saveAll();
        self.refresh_title();
        
        return scene.currentProjectPath();
    }
    
    self.needs_saving_project = function (data)
    {
        return scene.isDirty();
    }

    self.close_project = function(data)
    {
        // we do not really close the project, but open the startup one
        var startup_project = System.getenv("SGTK_HARMONY_ENGINE_STARTUP_PROJECT");
        self.window.requestOpenScene(scene);
        self.refresh_title();
    }
    
    self.is_startup_project = function(data)
    {   
        var is_startup_scene = false;
        var sg_metadata = scene.metadata("Shotgun Toolkit Engine");
        
        if (sg_metadata != null)
            is_startup_scene = sg_metadata.value == "Startup template";
        
        return is_startup_scene;
    }

    // Time line
    self.get_start_frame = function(data)
    {
        var start_frame = scene.getStartFrame();
        return start_frame;
    }

    self.set_start_frame = function(data)
    {
        scene.beginUndoRedoAccum("Set Start Frame");
        scene.setStartFrame(data.start_frame);
        var start_frame = scene.getStartFrame();
        start_frame_metadata = {
                                  "name"       : "sg_start_frame",
                                  "type"       : "int",
                                  "creator"    : "Shotgun Harmony Engine",
                                  "version"    : "1.0",
                                  "value"      : start_frame
                               };
        scene.setMetadata(start_frame_metadata);
        scene.endUndoRedoAccum();

        return start_frame;
    }

    self.get_stop_frame = function(data)
    {
        var stop_frame = scene.getStopFrame();
        return stop_frame;
    }

    self.set_stop_frame = function(data)
    {
        scene.beginUndoRedoAccum("Set Stop Frame");
        scene.setStopFrame(data.stop_frame);

        var stop_frame = scene.getStopFrame();
        stop_frame_metadata = {
                                  "name"       : "sg_stop_frame",
                                  "type"       : "int",
                                  "creator"    : "Shotgun Harmony Engine",
                                  "version"    : "1.0",
                                  "value"      : stop_frame
                               };

        scene.setMetadata(stop_frame_metadata);
        scene.endUndoRedoAccum();

        return stop_frame;
    }

    self.get_frame_range = function(data)
    {
        var start_frame = scene.getStartFrame();
        var stop_frame = scene.getStopFrame();
        return {start_frame:start_frame, stop_frame:stop_frame};
    }

    self.get_frame_count = function(data)
    {
        var frame_count = frame.numberOf();
        return frame_count;
    }

    self.set_frame_count = function(data)
    {
        scene.beginUndoRedoAccum("Set Frame Count");

        var current_frame_count = self.get_frame_count();
        var frame_count = data.frame_count;

        if (frame_count > current_frame_count)
        {
            // add frames if needed
            frame.insert(current_frame_count, frame_count - current_frame_count);
        }
        else
        {
            // remove frames if needed
            frame.remove(current_frame_count, current_frame_count - frame_count);
        }
        scene.endUndoRedoAccum();

        return self.get_frame_count();
    }

    self.set_frame_range = function(data)
    {
        scene.beginUndoRedoAccum("Set Frame Range");
        var start_frame = self.set_start_frame(data);
        var stop_frame = self.set_stop_frame(data);
        scene.endUndoRedoAccum();

        return {start_frame:start_frame, stop_frame:stop_frame};
    }

    self.get_frame_rate = function(data)
    {
        var frame_rate = scene.getFrameRate();
        return frame_rate;
    }

    // Actions
    self.import_drawing = function(data)
    {
        scene.beginUndoRedoAccum("Import Drawing");
        var path = data.path;
        var read_node = import_image(path);
        setNodeMetadata(read_node, META_SHOTGUN_PATH, path);
        scene.endUndoRedoAccum();
        return read_node;
    }

    self.import_audio = function(data)
    {
        scene.beginUndoRedoAccum("Import Audio");
        var path = data.path;
        var result = import_sound(path);
        scene.endUndoRedoAccum();

        return result;
    }

    self.getSubNodesByType = function(root,type)
    {
        //verifica se ha algum animatic na cena e retorna ele
        var sub_nodes = node.subNodes(root);
        var read_nodes = [];
        for(var i = 0; i < sub_nodes.length; i++){
          if(node.type(sub_nodes[i]) == type){
            read_nodes.push(sub_nodes[i]);
          }     
        }

        return read_nodes;
    }


    //clean any garbage kept by importAnimatic
    self.clean_animatic_cache = function(){

        var temp_folder = specialFolders.temp;
        var regex_columName = /(ATV-\w{16})$/;
        var list_folders = list_files(temp_folder, "*");
        var progressDlg;
        progressDlg = new QProgressDialog();
        progressDlg.open();
        progressDlg.setRange(0, list_folders.length -1);

        var count = 0;
        for(var i=0; i<list_folders.length; i++){

            progressDlg.setValue(i);
            progressDlg.setLabelText("Cleaning temp folder...\n" + list_folders[i]);
            if(regex_columName.test(list_folders[i])){
                var to_delete = temp_folder + "/" + list_folders[i];
                MessageLog.trace("Trash found: " + list_folders[i]);
                if(removeDirs(to_delete)){
                    count++;
                }
            }
        }

        progressDlg.hide();
        MessageBox.information("Cache cleaned!! " + count + " folders deleted!");

    }

    self.sg_import_animatic = function(data)
    {
        scene.beginUndoRedoAccum("Import Animatic");
        var movie_file = data.animatic;
        var node_path = data.node_path;
        var status = false;

        if(node.getName(node_path) == ""){
            MessageBox.information("ERROR! Group not found : " + node_path);
        }
        else{

            var animatic = import_movie(movie_file, node_path);
            if(node.getName(animatic) != ""){
                MessageBox.information("Animatic imported sucessfully!");
                status = true;
            } 
            else {
                MessageBox.information("Failed to import the animatic!");
            }
        }
      
        self.clean_animatic_cache();
        scene.endUndoRedoAccum();

        return status;
    }

    self.import_clip = function(data)
    {
        scene.beginUndoRedoAccum("Import Movie");
        var path = data.path;
        var read_node = import_movie(path);
        setNodeMetadata(read_node, META_SHOTGUN_PATH, path);
        scene.endUndoRedoAccum();

        return read_node;
    }

    self.get_node_metadata = function(data)
    {
        var node = data.node;
        var attr_name = data.attr_name;
        var result = getNodeMetadata(node, attr_name);
        return result;
    }

    self.get_scene_metadata = function(data)
    {
        var attr_name = data.attr_name;
        var result = getSceneMetadata(attr_name);
        return result;
    }

    self.get_nodes_of_type = function(data)
    {
        var node_types = data.node_types;
        return node.getNodes(node_types);
    }


    self.get_columns_of_type = function(data)
    {
        var column_type = data.column_type;
        var columns = column.getColumnListOfType(column_type);
        return columns;
    }

    self.get_sound_column_filenames = function(data)
    {
        var column_name = data.column_name;
        var sound_column = column.soundColumn(column_name)

        var sound_sequences = sound_column.sequences()
        
        var sound_filenames = [] 

        for (var j in sound_sequences)
        {
            var sound_sequence = sound_sequences[j];
            var sound_filename = sound_sequence.filename;
            if (sound_filename != undefined)
                sound_filenames.push(sound_filename);
        }

        return sound_filenames;
    }

    // ----
    self.ping = function(data)
    {
        return "PONG";
    }

    self.adquire_main_window = function()
    {
        var active_window = QApplication.activeWindow();
        self.set_main_window(active_window);
    }

    self.refresh_title = function()
    {
        if (self.window != null)
        {
            if (self.is_startup_project())
            {
                version_name = "Shotgun Toolkit - Open a file from the shotgun menu.";
            }
            else
            {
                version_name = scene.currentVersionName();
            }
    
            if (version_name == "")
                version_name = scene.currentScene();
    
            app_version = about.productName();
            var title = app_version + " Project: " + version_name;
            self.window.setWindowTitle(title);
        }
        else
        {
            MessageLog.trace("Refresh title: window not ready!");
        }
    }


    self.sg_node_is_group = function(data){

      var n = data.node;
      return node.isGroup(n);

    }

    self.sg_node_get_name = function(data){

      var n = data.node;
      return node.getName(n);
      
    }

    self.sg_node_type = function(data){

      var n = data.node;
      return node.type(n);
      
    }

    self.sg_number_of_subnodes = function(data){

        var parent = data.parent;
        return node.numberOfSubNodes(parent);
      
    }   

    self.sg_node_subnodes = function(data){

        var parent = data.parent;
        return node.subNodes(parent);

    }

    self.sg_node_add_composite_to_group = function(data){

        var n = data.node;
        return node.addCompositeToGroup(n);

    }

    self.sg_node_subnode = function(data){

        var parent = data.parent;
        var index = data.index;
        return node.subNode(parent,index);

    }

    self.sg_node_subnode_by_name = function(data){

        var parent = data.parent;
        var name = data.name;
        return node.subNodeByName(parent,name);
    }

    self.sg_node_parent_node = function(data){

        var n = data.node;
        return node.parentNode(n);
    }

    self.sg_node_equals = function(data){

        var n1 = data.node1;
        var n2 = data.node2;
        return node.equals(n1,n2);

    }

    self.sg_node_get_text_attr = function(data){

        var n = data.node;
        var frame = data.frame;
        var attr = data.attr;
        return node.getTextAttr(n,frame,attr);

    }

    self.sg_node_get_attr = function(data){


    }

    self.sg_node_get_attr_list = function(data){


    }


    self.sg_node_get_all_attr_names = function(data){

        var n = data.node;
        return node.getAllAttrNames(n);

    }

    self.sg_node_get_all_attr_keywords = function(data){

        var n = data.node;
        return node.getAllAttrKeywords(n);
        
    }

    self.sg_node_linked_column = function(data){

        var n = data.node;
        var attr = data.attr;
        return node.linkedColumn(n,attr);

    }

    self.sg_node_coord_x = function(data){

        var n = data.node;
        return node.coordX(n);

    }

    self.sg_node_coord_y = function(data){

        var n = data.node;
        return node.coordY(n);
        
    }

    self.sg_node_coord_z = function(data){

        var n = data.node;
        return node.coordZ(n);
        
    }

    self.sg_node_width = function(data){

        var n = data.node;
        return node.width(n);

    }

    self.sg_node_height = function(data){

        var n = data.node;
        return node.height(n);

    }

    self.sg_node_set_coord = function(data){

        var n = data.node;
        var x = data.x;
        var y = data.y;
        var z = data.z;

        if(z == null){
            return node.setCoord(n,x,y);
        }
        
        return node.setCoord(n,x,y,z);

    }

    self.sg_node_number_of_input_ports = function(data){

        var n = data.node;
        return node.numberOfInputPorts(n);

    }

    self.sg_node_is_linked = function(data){

        var n = data.node;
        var port = data.port;
        return node.isLinked(n,port);
    
    }

    self.sg_node_src_node = function(data){

        var n = data.node;
        var port = data.port;
        return node.srcNode(n,port);
    
    }

    self.sg_node_flat_src_node = function(data){

        var n = data.node;
        var port = data.port;
        return node.flatSrcNode(n,port);
    
    }

    self.sg_node_src_node_info = function(data){



    }

    self.sg_node_number_of_output_ports = function(data){

        var n = data.node;
        return node.numberOfOutputPorts(n);

    }

    self.sg_node_number_of_output_links = function(data){

        var n = data.node;
        var port = data.port
        return node.numberOfOutputLinks(n,port);

    }     

    self.sg_node_dst_node = function(data){

        var n = data.node;
        var port = data.port;
        var link = data.link;
        return node.dstNode(n,port,link);
    
    }

    self.sg_node_dst_node_info = function(data){



    }

    self.sg_node_group_at_network_building = function(data){

        var n = data.node;
        return node.groupAtNetworkBuilding(n);
    
    } 

    self.sg_node_add = function(data){

        var parent = data.parent;
        var name = data.name;
        var type = data.type;
        var x = data.x;
        var y = data.y;
        var z = data.z;
        return node.add(parent,name,type,x,y,z);

    }

    self.sg_node_get_group_input_module = function(data){

        var parent = data.parentGroup;
        var name = data.name;
        var x = data.x;
        var y = data.y;
        var z = data.z;
        return node.getGroupInputModule(parentGroup,name,x,y,z);
        
    }

    self.sg_node_get_group_output_module = function(data){

        var parentGroup = data.parentGroup;
        var name = data.name;
        var x = data.x;
        var y = data.y;
        var z = data.z;

        return node.getGroupOutputModule(parentGroup,name,x,y,z);

    }

    self.sg_node_delete_node = function(data){

        var nodePath = data.nodePath;
        var deleteTimedValues = data.deleteTimedValues;
        var deleteElements = data.deleteElements;

        return node.deleteNode(nodePath,deleteTimedValues,deleteElements);

    }

    self.sg_node_create_group = function(data){

        var nodes = data.nodes;
        var groupName = data.groupName;

        return node.createGroup(nodes,groupName);
    }

    self.sg_node_move_to_group = function(data){

        var n = data.node;
        var groupName = data.groupName;

        return node.moveToGroup(n,groupName);

    }

    self.sg_node_explode_group = function(data){

        var groupNode = data.groupNode;
        return node.explodeNode(groupNode);
    }

    self.sg_node_rename = function(data){

        var n = data.node;
        var newName = data.newName;

        return node.rename(n,newName);

    }

    self.sg_node_create_dynamic_attr = function(data){

        var n = data.node;
        var type = node.type;
        var attrName = node.attrName;
        var displayName = node.displayName;
        var linkable = node.linkable;

        return node.createDynamicAttr(n,type,attrName,displayName,linkable);

    }

    self.sg_node_remove_dynamic_attr = function(data){

        var n = data.node;
        var attrName = node.attrName;

        return node.removeDynamicAttr(n,attrName);
    }

    self sg_node_set_text_attr = function(data){

        var n = data.node; 
        var attrName = data.attrName; 
        var atFrame = data.atFrame; 
        var attrValue = data.attrValue;

        return node.setTextAttr(n,attrName,atFrame,attrValue);

    }

    self.sg_node_link_attr = function(data){

        var n = data.node; 
        var attrName = data.attrName; 
        var columnName = data.columnName;

        return node.linkAttr(n,attrName,columnName);
    }

    self.sg_node_unlink_attr = function(data){

        var n = data.node; 
        var attrName = data.attrName;

        return node.unlinkAttr(n,attrName);
    }

    self.sg_node_link = function(data){

        var srcNode = data.srcNode;
        var srcPort = data.srcPort;
        var dstNode = data.dstNode;
        var dstPort = data.dstPort;
        var mayAddOutputPort = data.mayAddOutputPort;
        var mayAddInputPort = data.mayAddInputPort;

        return node.link(srcNode,srcPort,dstPort,dstPort,mayAddOutputPort,mayAddInputPort);
    }

    self.sg_node_unlink = function(data){

        var dstNode = data.dstNode;
        var inPort = data.inPort;

        return node.link(dstPort,inPort);
    }

    self.sg_node_set_enable = function(data){

        var n = data.node;
        var flag = data.flag;
        return node.setEnable(n,flag);
    }

    self.sg_node_get_enable = function(data){

        var n = data.node;
        return node.getEnabled(n);
    }

    self.sg_node_set_locked = function(data){

        var n = data.node;
        var lock = data.lock;
        return node.setLocked(n,lock);

    }

    self.sg_node_get_locked = function(data){

        var n = data.node;
        return node.getLocked(n);

    }

    self.sg_node_set_timeline_tag = function(data){

        var n = data.node;
        var tag = data.tag;
        return node.setTimelineTag(n,tag);
    }

    self.sg_node_get_timeline_tag = function(data){

        var n = data.node;
        return node.getTimelineTag(n);
    }

    self.sg_node_get_timeline_tag_list = function(data){

        var n = data.node;
        var list = data.list;
        return node.getTimelineTagList(n,list);
    }

    self.sg_node_set_color = function(data){

        var n = data.node;
        var color = data.color;

        return node.setColor(n,color);
    }

    self.sg_node_reset_color = function(data){

        var n = data.node;
        return node.resetColor(n);
    }

    self.sg_node_get_color = function(data){

        var n = data.node;
        return node.getColor(n);

    }

    self.sg_node_set_as_global_display = function(data){

        var n = data.node;
        return node.setAsGlobalDisplay(n)
    }

    self.sg_node_set_global_to_display_all = function(data){

        return node.setGlobalToDisplayAll();
    }

    self.sg_node_set_as_default_camera = function(data){

        var n = data.node;
        return node.setAsDefaultCamera(n);
    }

    self.sg_node_get_default_camera = function(data){

        return node.getDefaultCamera();
    }

    self.sg_node_get_cameras = function(data){

        return node.getCameras();

    }

    self.sg_node_get_max_version_number = function(data){

        var n = data.node;
        return node.getMaxVersionNumber(n);

    }

    self.sg_node_get_version = function(data){

        var n = data.node;
        return node.getVersion(n);

    }

    self.sg_node_set_version = function(data){

        var n = data.node;
        var version = data.version;
        return node.setVersion(n,version);
    }

    self.sg_node_get_nodes = function(data){

        var types = data.types;
        return node.getNodes(types);
    }

    self.sg_node_get_matrix = function(data){

        var n = data.node;
        var frame = data.frame;
        return node.getMatrix(n,frame);
    }

    self.sg_node_get_pivot = function(data){

        var n = data.node;
        var frame = data.frame;

        return node.getPivot(n,frame);
    }

    self.sg_node_get_color_override = function(data){

        var n = data.node;

        return node.getColorOverride(n);
    }

    self.sg_node_get_element_id = function(data){

        var nodeName = data.nodeName;
        return getElementId(nodeName);
    }

    self.sg_node_explode_element_symbols_in_groups = function(data){

        var element = data.element;
        var disableElement = data.disableElement;
        var clearExposure = data.clearExposure;
        var prefix = data.prefix;

        return node.explodeElementSymbolsInGroups(element,disableElement,clearExposure,prefix);
    }

    self.sg_node_set_show_timeline_thumbnails = function(data){

        var n = data.node;
        var bShow = data.bShow;

        return node.setShowTimelineThumbnails(n,bShow);
    }

    self.sg_node_get_show_timeline_thumbnails = function(data){

        var n = data.node;
        return node.getShowTimelineThumbnails(n); 
    }
    // ------------------------------------------------------------------------

    self.registerCallback = function(command, callback)
    {
        self.server.register_command(command, callback)
        self.log_debug("Registered callback: " + command);

    }

    self.register_callbacks = function()
    {
        //self.registerCallback("SHOW_MENU",   self.show_menu);

        //about module
        self.registerCallback("SG_ABOUT_IS_WINDOWS_ARCH",about.isWindowsArch);
        self.registerCallback("SG_ABOUT_IS_LINUX_ARCH",about.isLinuxArch);
        self.registerCallback("SG_ABOUT_IS_MAC_ARCH",about.isMacArch);
        self.registerCallback("SG_ABOUT_IS_MAC_INTEL_ARCH",about.isMacIntelArch);
        self.registerCallback("SG_ABOUT_IS_MAC_PPC_ARCH",about.isMacPpcArch);
        self.registerCallback("SG_ABOUT_GET_APPLICATION_PATH",about.getApplicationPath);
        self.registerCallback("SG_ABOUT_GET_BINARY_PATH",about.getBinaryPath);
        self.registerCallback("SG_ABOUT_GET_RESOURCES_PATH",about.getResourcesPath);
        //node module
        self.registerCallback("SG_NODE_ROOT",node.root);
        self.registerCallback("SG_NODE_IS_GROUP",self.sg_node_is_group);
        self.registerCallback("SG_NODE_GET_NAME",self.sg_node_get_name);
        self.registerCallback("SG_NODE_TYPE",self.sg_node_type);
        self.registerCallback("SG_NODE_NUMBER_OF_SUB_NODES",self.sg_number_of_subnodes);
        self.registerCallback("SG_NODE_SUB_NODES",self.sg_node_subnodes);
        self.registerCallback("SG_NODE_ADD_COMPOSITE_TO_GROUP",self.sg_node_add_composite_to_group);
        self.registerCallback("SG_NODE_SUBNODE",self.sg_node_subnode);
        self.registerCallback("SG_NODE_SUBNODE_BY_NAME",self.sg_subnode_by_name);
        self.registerCallback("SG_NODE_PARENT_NODE",self.sg_node_parent_node);
        self.registerCallback("SG_NODE_NO_NODE",node.noNode);
        self.registerCallback("SG_NODE_EQUALS",self.sg_node_equals);
        self.registerCallback("SG_NODE_GET_TEXT_ATTR",self.sg_node_get_text_attr);
        self.registerCallback("SG_NODE_GET_ATTR",self.sg_node_get_attr);
        self.registerCallback("SG_NODE_GET_ATTR_LIST",self.sg_node_get_attr_list);
        self.registerCallback("SG_NODE_GET_ALL_ATTR_NAMES",self.sg_node_get_all_attr_names);
        self.registerCallback("SG_NODE_GET_ALL_ATTR_KEYSWORDS",self.sg_node_get_all_attr_keywords);
        self.registerCallback("SG_NODE_LINKED_COLUMN",self.sg_node_linked_column);
        self.registerCallback("SG_NODE_COORD_X",self.sg_node_coord_x);
        self.registerCallback("SG_NODE_COORD_Y",self.sg_node_coord_y);
        self.registerCallback("SG_NODE_COORD_Z",self.sg_node_coord_z);
        self.registerCallback("SG_NODE_WIDTH",self.sg_node_width);
        self.registerCallback("SG_NODE_HEIGHT",self.sg_node_height);
        self.registerCallback("SG_NODE_SET_COORD",self.sg_node_set_coord);
        self.registerCallback("SG_NODE_NUMBER_OF_INPUT_PORTS",self.sg_node_number_of_input_ports);
        self.registerCallback("SG_NODE_IS_LINKED",self.sg_node_is_linked);
        self.registerCallback("SG_NODE_SRC_NODE",self.sg_node_src_node);
        self.registerCallback("SG_NODE_FLAT_SRC_NODE",self.sg_node_flat_src_node); 
        self.registerCallback("SG_NODE_SRC_NODE_INFO",self.sg_node_src_node_info);
        self.registerCallback("SG_NODE_NUMBER_OF_OUTPUT_PORTS",self.sg_node_number_of_output_ports);
        self.registerCallback("SG_NODE_NUMBER_OF_OUTPUT_LINKS",self.sg_node_number_of_output_links);
        self.registerCallback("SG_NODE_DST_NODE",self.sg_node_dst_node);
        self.registerCallback("SG_NODE_DST_NODE_INFO",self.sg_node_dst_node_info);
        self.registerCallback("SG_NODE_GROUP_AT_NETWORK_BUILDING",self.sg_node_group_at_network_building);
        self.registerCallback("SG_NODE_ADD", self.sg_node_add);
        self.registerCallback("SG_NODE_GET_GROUP_INPUT_MODULE", self.sg_node_get_group_input_module);
        self.registerCallback("SG_NODE_GET_GROUP_OUTPUT_MODULE", self.sg_node_get_group_output_module);
        self.registerCallback("SG_NODE_DELETE_NODE", self.sg_node_delete_node);
        self.registerCallback("SG_NODE_CREATE_GROUP", self.sg_node_create_group);
        self.registerCallback("SG_NODE_MOVE_TO_GROUP", self.sg_node_move_to_group);
        self.registerCallback("SG_NODE_EXPLODE_GROUP", self.sg_node_explode_group);
        self.registerCallback("SG_NODE_RENAME", self.sg_node_rename);
        self.registerCallback("SG_NODE_CREATE_DYNAMIC_ATTR", self.sg_node_create_dynamic_attr);
        self.registerCallback("SG_NODE_REMOVE_DYNAMIC_ATTR", self.sg_node_remove_dynamic_attr);
        self.registerCallback("SG_NODE_SET_TEXT_ATTR", self.sg_node_set_text_attr);
        self.registerCallback("SG_NODE_LINK_ATTR", self.sg_node_link_attr);
        self.registerCallback("SG_NODE_UNLINK_ATTR", self.sg_node_unlink_attr);
        self.registerCallback("SG_NODE_LINK", self.sg_node_link);
        self.registerCallback("SG_NODE_UNLINK", self.sg_node_unlink);
        self.registerCallback("SG_NODE_SET_ENABLE", self.sg_node_set_enable);
        self.registerCallback("SG_NODE_GET_ENABLE", self.sg_node_get_enable);
        self.registerCallback("SG_NODE_SET_LOCKED", self.sg_node_set_locked);
        self.registerCallback("SG_NODE_GET_LOCKED", self.sg_node_get_locked);
        self.registerCallback("SG_NODE_SET_TIMELINE_TAG", self.sg_node_set_timeline_tag);
        self.registerCallback("SG_NODE_GET_TIMELINE_TAG", self.sg_node_get_timeline_tag);
        self.registerCallback("SG_NODE_GET_TIMELINE_TAG_LIST", self.sg_node_get_timeline_tag_list);
        self.registerCallback("SG_NODE_SET_COLOR", self.sg_node_set_color);
        self.registerCallback("SG_NODE_RESET_COLOR", self.sg_node_reset_color);
        self.registerCallback("SG_NODE_GET_COLOR", self.sg_node_get_color);
        self.registerCallback("SG_NODE_SET_AS_GLOBAL_DISPLAY", self.sg_node_set_as_global_display);
        self.registerCallback("SG_NODE_SET_GLOBAL_TO_DISPLAY_ALL", self.sg_node_set_global_to_display_all);
        self.registerCallback("SG_NODE_SET_AS_DEFAULT_CAMERA", self.sg_node_set_as_default_camera);
        self.registerCallback("SG_NODE_GET_DEFAULT_CAMERA", self.sg_node_get_default_camera);
        self.registerCallback("SG_NODE_GET_CAMERAS", self.sg_node_get_cameras);
        self.registerCallback("SG_NODE_GET_MAX_VERSION_NUMBER", self.sg_node_get_max_version_number);
        self.registerCallback("SG_NODE_GET_VERSION", self.sg_node_get_version);        
        self.registerCallback("SG_NODE_SET_VERSION", self.sg_node_set_version); 
        self.registerCallback("SG_NODE_GET_NODES", self.sg_node_get_nodes); 
        self.registerCallback("SG_NODE_GET_MATRIX", self.sg_node_get_matrix); 
        self.registerCallback("SG_NODE_GET_PIVOT", self.sg_node_get_pivot); 
        self.registerCallback("SG_NODE_GET_VERSION", self.sg_node_get_version); 
        self.registerCallback("SG_NODE_GET_COLOR_OVERRIDE", self.sg_node_get_color_override); 
        self.registerCallback("SG_NODE_GET_ELEMENT_ID", self.sg_node_get_element_id); 
        self.registerCallback("SG_NODE_EXPLODE_ELEMENT_SYMBOLS_IN_GROUPS", self.sg_node_explode_element_symbols_in_groups); 
        self.registerCallback("SG_NODE_SET_SHOW_TIMELINE_THUMBNAILS", self.sg_node_set_show_timeline_thumbnails); 
        self.registerCallback("SG_NODE_GET_SHOW_TIMELINE_THUMBNAILS", self.sg_node_get_show_timeline_thumbnails);
        self.registerCallback("LOG_INFO",       log_info);
        self.registerCallback("LOG_WARNING",    log_warning);
        self.registerCallback("LOG_DEBUG",      log_debug);
        self.registerCallback("LOG_ERROR",      log_error);
        self.registerCallback("LOG_EXCEPTION",  log_exception);
        self.registerCallback("GET_VERSION",    self.get_version);
        self.registerCallback("ENGINE_READY",   self.engine_ready);
        self.registerCallback("ENGINE_RESTART",   self.engine_restart);
        self.registerCallback("OPEN_PROJECT",             self.open_project);
        self.registerCallback("GET_CURRENT_PROJECT_FOLDER", self.current_project_folder);
        self.registerCallback("GET_CURRENT_PROJECT_PATH", self.current_project_path);
        self.registerCallback("SAVE_PROJECT",             self.save_project);
        self.registerCallback("SAVE_NEW_VERSION",             self.save_new_version);
        self.registerCallback("SAVE_NEW_VERSION_ACTION", self.save_new_version_action);
        self.registerCallback("NEEDS_SAVING",           self.needs_saving_project);
        self.registerCallback("CLOSE_PROJECT",          self.close_project);
        self.registerCallback("EXECUTE_STATEMENT",      self.execute_statement);
        self.registerCallback("EXTRACT_THUMBNAIL",      self.extract_thumbnail);
        self.registerCallback("TOGGLE_DEBUG_LOGGING",   self.toggle_debug_logging);
        self.registerCallback("IS_STARTUP_PROJECT",     self.is_startup_project);
        
        // timeline
        self.registerCallback("GET_FRAME_RANGE",     self.get_frame_range);
        self.registerCallback("SET_FRAME_RANGE",     self.set_frame_range);
        
        self.registerCallback("GET_FRAME_COUNT",     self.get_frame_count);
        self.registerCallback("SET_FRAME_COUNT",     self.set_frame_count);
        
        self.registerCallback("GET_START_FRAME",     self.get_start_frame);
        self.registerCallback("SET_START_FRAME",     self.set_start_frame);
        
        self.registerCallback("GET_STOP_FRAME",      self.get_stop_frame);
        self.registerCallback("SET_STOP_FRAME",      self.set_stop_frame);

        // actions
        self.registerCallback("IMPORT_DRAWING",      self.import_drawing);
        self.registerCallback("IMPORT_AUDIO",        self.import_audio);
        self.registerCallback("IMPORT_CLIP",         self.import_clip);

        // metadata
        self.registerCallback("GET_NODE_METADATA",   self.get_node_metadata);
        self.registerCallback("GET_SCENE_METADATA",   self.get_scene_metadata);

        // scene inspection
        self.registerCallback("GET_NODES_OF_TYPE",   self.get_nodes_of_type);
        self.registerCallback("GET_COLUMNS_OF_TYPE", self.get_columns_of_type);
        self.registerCallback("GET_SOUND_COLUMN_FILENAMES", self.get_sound_column_filenames);

        self.registerCallback("PING", self.ping);

        self.registerCallback("CLOSE",   self.stop);
        self.log_debug("Registered callbacks");
    }

    self.start = function()
    {
         if (self.server != null)
        {
            self.log_debug("Killed server");
            self.server.close();
            self.server = null;
        }

         if (self.server == null)
        {
            self.log_debug("New server");
            var host = System.getenv("SGTK_HARMONY_ENGINE_HOST");
            var port = parseInt(System.getenv("SGTK_HARMONY_ENGINE_PORT"));

            self.server = new Server(host, port);
            self.register_callbacks();
            self.server.start();
        }
        else
        {
            self.log_debug("Restarting the server");
            self.server.close();
            self.server.start();
        }
        MessageLog.trace("--");
    }

    self.stop = function()
    {
        if (self.server != null)
        {
            self.log_debug("Killed server");
            self.server.close();
            self.server = null;
        }   
    }

    self.show_menu = function()
    {
        var x = QCursor.pos().x();
        var y = QCursor.pos().y();
        self.server.send_command("SHOW_MENU", {"clickedPosition":{"x":x, "y":y}});
    }

    self.on_about_to_quit = function()
    {
        // I do not think there is actually time for this to happen
        // but it is here for completion
        self.server.send_command("QUIT", {});

        // this is the reliable way to kill our engine process
        var engine_pid = System.getenv("SGTK_HARMONY_ENGINE_PID");
        p = new Process2 (parseInt(engine_pid));
        p.terminate();
    }    
}

function Shotgun()
{
    // Check if we are under a shotgun desktop environment first.
    // Has Harmony be opened through the Shotgun Launcher ?
    var engine = System.getenv("SGTK_ENGINE");
    var context = System.getenv("SGTK_CONTEXT");
    if (engine == "" || context == "")
    {
        var message = "Harmony has not been run from within the Shotgun Desktop Launcher.\n\nNot under a Shotgun Desktop environment.\n";
        MessageLog.trace(message);
        return false;
    }

    MessageLog.trace("Shotgun engine...");
    var engine_port = System.getenv("SGTK_HARMONY_ENGINE_PORT");
    MessageLog.trace("Shotgun engine port: " + engine_port);

    var app = QCoreApplication.instance();
    var active_window = QApplication.activeWindow();
    var engine = app.shotgun_engine;

    if (engine == null)
    {
        engine = new Engine();
        engine.start();
        bootstrap();
        app.shotgun_engine = engine;

        // connect callbacks to the engine
        // make sure we remove the python engine when we quit harmony
        app.aboutToQuit.connect(app, engine.on_about_to_quit);
    }

    if (engine != null)
    {
        if (!engine.is_engine_ready)
        {
            engine.clear_busy();
            engine.show_busy("Initializing Shotgun Engine, please wait ...",  "Shotgun engine is being loaded at the moment, this dialog will close once the connection has been established.");
            System.processOneEvent();

            engine.on_engine_ready_callbacks.push(engine.clear_busy);
            engine.on_engine_ready_callbacks.push(engine.adquire_main_window);
            engine.on_engine_ready_callbacks.push(engine.refresh_title);
        }
    }
    MessageLog.trace("Shotgun engine...Done")
    return true;
}

function ShotgunMenu()
{
    var initialized = Shotgun();

    if (!initialized)
    {
        var message = "Harmony has not been run from the Shotgun within Desktop Launcher.\n\nNot under a Shotgun Desktop environment.\n";
        MessageBox.information(message, 0,0,0 , "Shotgun Harmony Engine")
        return;
    }

    var app = QCoreApplication.instance();
    var engine = app.shotgun_engine;

    if (engine != null)
    {
        var active_window = QApplication.activeWindow();
        engine.set_main_window(active_window);

        if (engine.is_engine_ready)
        {
            engine.show_menu();
            engine.refresh_title();
        }
    }
}

function bootstrap()
{

    var SGTK_HARMONY_ENGINE_RESOURCES_PATH = System.getenv("SGTK_HARMONY_ENGINE_RESOURCES_PATH");

    //MessageLog.trace("Including : " + SGTK_HARMONY_ENGINE_RESOURCES_PATH+"/startup/client.js");
    //include(SGTK_HARMONY_ENGINE_RESOURCES_PATH+"/startup/client.js");

    // MessageLog.trace("Including : " + SGTK_HARMONY_ENGINE_RESOURCES_PATH+"/startup/ui.js");
    // include(SGTK_HARMONY_ENGINE_RESOURCES_PATH+"/startup/ui.js");

    var app = QCoreApplication.instance();
    var engine_is_up = typeof(app.__SGTK_STARTUP_INIT__) != "undefined";
    if (engine_is_up)
        engine_is_up = engine_is_up && typeof(app.shotgun) != "undefined";

    if (engine_is_up)
        engine_is_up = engine_is_up && typeof(app.shotgun.engine_process) != "undefined";

    if (engine_is_up)
        engine_is_up = engine_is_up && app.shotgun.engine_process.isAlive() == true;

    MessageLog.trace("engine_is_up:" + engine_is_up);
    if (engine_is_up)
        MessageLog.trace("app.shotgun.engine_process:" + app.shotgun.engine_process);

    var do_startup = !engine_is_up;
    MessageLog.trace("do_startup:" + do_startup);

    if (do_startup)
    {
        if (typeof(app.shotgun) === "undefined")
            app.shotgun = {};

        MessageLog.trace('-------------------------');
        MessageLog.trace('Shotgun startup started');
        MessageLog.trace('-------------------------');

        var python_exec = System.getenv('SGTK_HARMONY_ENGINE_PYTHON');
        var boostrap_py = System.getenv('SGTK_HARMONY_ENGINE_STARTUP');
        var engine_name = 'tk-harmony';
        var engine_port = System.getenv('SGTK_HARMONY_ENGINE_PORT');
        var app_id = 'basic.*`';
        MessageLog.trace('Initializing Shotgun Harmony engine ...');
        MessageLog.trace('   engine name: ' + engine_name);
        MessageLog.trace('   engine port: ' + engine_port );
        MessageLog.trace('   engine app id: ' + app_id);
        MessageLog.trace('   engine python: ' + python_exec);
        MessageLog.trace('   engine bootstrap: ' + boostrap_py);

        var engine_process = new Process2(python_exec, boostrap_py,  engine_port, engine_name, app_id);  
        MessageLog.trace('About to execute: ');
        MessageLog.trace(engine_process.commandLine());

        var error = engine_process.launchAndDetach();
        MessageLog.trace('error ' + error );

        app.shotgun.window = null;
        app.shotgun.engine_name = engine_name;

        app.shotgun.engine_process = engine_process;
        app.shotgun.engine_pid = engine_process.pid();

        app.shotgun.engine_host = "localhost";
        app.shotgun.engine_port = parseInt(engine_port);

        app.shotgun.debug = true;

        MessageLog.trace("Registered onAboutToQuit callback: " + app.aboutToQuit);
        app.aboutToQuit.connect(app, app.shotgun.engine_process.terminate);

        app.__SGTK_STARTUP_INIT__ = true;

        MessageLog.trace('Shotgun startup finished.');
        MessageLog.trace('-------------------------');
    }
    else
    {
        MessageLog.trace(this.__SGTK_STARTUP_INIT__);
    }
}

function init()
{
    MessageLog.trace("Shotgun Initalization...");
    Shotgun()
    MessageLog.trace("Shotgun Initalization... Done");
}


exports.configure = configure;
exports.init = init;
