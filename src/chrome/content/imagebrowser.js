/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Image Browser.
 *
 * The Initial Developer of the Original Code is
 *      Dave Townsend <dave.townsend@blueprintit.co.uk>.
 *
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK *****
 *
 * $HeadURL$
 * $LastChangedBy$
 * $Date$
 * $Revision$
 *
 */

var mDisplayPanel = null;
var mFolder = null;

function openWindowByType(inType, uri, features)
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
  var topWindow = windowManagerInterface.getMostRecentWindow(inType);

  if (topWindow)
    topWindow.focus();
  else if (features)
    window.open(uri, "_blank", features);
  else
    window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

var Comparators = {
	name: function(a,b)
	{
		if (a.leafName < b.leafName)
			return -1;
		if (a.leafName > b.leafName)
			return 1;
		return 0;
	},
	
	date: function(a,b)
	{
		return a.lastModifiedTime - b.lastModifiedTime;
	},
	
	size: function(a,b)
	{
		return a.fileSize - b.fileSize;
	},
	
	type: function(a,b)
	{
		function getType(file)
		{
			var name = file.leafName;
			var pos = name.indexOf(".");
			if (pos>0)
				return name.substr(pos+1).toLowerCase();
			else
				return "";
		}
		
		var typea = getType(a);
		var typeb = getType(b);
		if (typea < typeb)
			return -1;
		if (typea > typeb)
			return 1;
		return 0;
	}
}

var ProgressHandler = {
	total: 0,
	current: 0,
	
	addOperation: function(metric)
	{
		var meter = document.getElementById("progress-progressmeter");
		this.total += metric;
		meter.value = parseInt(this.current / this.total * 100);
		meter.hidden = false;
	},
	
	removeOperation: function(metric)
	{
		var meter = document.getElementById("progress-progressmeter");
		this.total -= metric;
		meter.value = parseInt(this.current / this.total * 100);
		if (this.current >= this.total)
		{
			meter.hidden = true;
			this.current = 0;
			this.total = 0;
		}
	},
	
	completeOperation: function(metric)
	{
		var meter = document.getElementById("progress-progressmeter");
		this.current += metric;
		meter.value = parseInt(this.current / this.total * 100);
		if (this.current >= this.total)
		{
			meter.hidden = true;
			this.current = 0;
			this.total = 0;
		}
	}
}

var ImageBrowser = {
	prefs: null,
	cache: null,
	comparator: null,
	
	scaleQueue: [],
	scalings: 0,
	maxScalings: 5,

	init: function(event)
	{
		var display = document.getElementById("display-deck");
		mDisplayPanel = display.selectedPanel;
		var type = mDisplayPanel.id.substring(0, mDisplayPanel.id.length-6);
		var menu = document.getElementById(type+"-menuitem");
		menu.setAttribute("checked", "true");

		var tree = document.getElementById("folder-tree");
		menu = document.getElementById("folderlist-menuitem");
		menu.setAttribute("checked", tree.hidden ? "false" : "true");
		
		this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
	                        .getService(Components.interfaces.nsIPrefService)
	                        .getBranch("imagebrowser.").QueryInterface(Components.interfaces.nsIPrefBranch2);
	
		this.maxScalings = this.prefs.getIntPref("scaling.parallels");
		this.comparator = this.prefs.getCharPref("sortorder");
		if (!(this.comparator in Comparators))
			this.comparator = "name";
		document.getElementById("sort-"+this.comparator+"-menuitem").setAttribute("checked", "true");

	  this.prefs.addObserver("",this,false);
	  window.addEventListener("unload", this, false);
	  window.addEventListener("resize", this, false);
	  window.removeEventListener("load", this, false);

		if (Components.classes["@mozilla.org/storage/service;1"])
		{
			var dbfile = Components.classes["@mozilla.org/file/directory_service;1"]
			                       .getService(Components.interfaces.nsIProperties)
			                       .get("ProfD", Components.interfaces.nsIFile);
			dbfile.append("cache.sqlite");
			var createtables = !dbfile.exists();
			
			var storageService = Components.classes["@mozilla.org/storage/service;1"]
			                               .getService(Components.interfaces.mozIStorageService);
			this.cache = storageService.openDatabase(dbfile);
			if (createtables)
				this.initialiseCache();
		}
		else
			this.logWarning("Warning, no storage service available. Nothing will be cached.");
		
		if (this.prefs.prefHasUserValue("lastdir"))
		{
			mFolder = Components.classes["@mozilla.org/file/local;1"]
			                    .createInstance(Components.interfaces.nsILocalFile);
			mFolder.initWithPath(this.prefs.getCharPref("lastdir"));
		}
		else
			mFolder = Components.classes["@mozilla.org/file/directory_service;1"]
			                    .getService(Components.interfaces.nsIProperties)
			                    .get("Home", Components.interfaces.nsIFile);

		var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var rdfs = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                         .getService(Components.interfaces.nsIRDFService);
		document.getElementById("folder-statusbarpanel").label = mFolder.path;
		var treeview = document.getElementById("folder-tree").view
		                       .QueryInterface(Components.interfaces.nsIXULTreeBuilder);
		var resource = rdfs.GetResource(ios.newFileURI(mFolder).spec);
		treeview.currentIndex = treeview.getIndexOfResource(resource);
		
		if ("initialise" in mDisplayPanel)
			mDisplayPanel.initialise();
		mDisplayPanel.onFolderChanged();
	},
	
	destroy: function(event)
	{
		this.prefs.setCharPref("lastdir", mFolder.path);
		if ("destroy" in mDisplayPanel)
			mDisplayPanel.destroy();
	  window.removeEventListener("unload", this, false);
	  window.removeEventListener("resize", this, false);
	  this.prefs.removeObserver("",this);
	},
	
	initialiseCache: function()
	{
		this.cache.createTable("Thumbnail", "file TEXT, size INTEGER, date INTEGER, uri TEXT, width INTEGER, height INTEGER, UNIQUE (file,size)");
	},
	
  logMessage: function(message)
  {
    Components.classes['@mozilla.org/consoleservice;1']
              .getService(Components.interfaces.nsIConsoleService)
              .logStringMessage("Image Browser: "+message);
  },
      
  logWarning: function(message)
  {
    var msg = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
    
    msg.init("Image Browser: "+message,
             "chrome://imagebrowser/content/imagebrowser.xml",
             "",
             0,
             0,
             Components.interfaces.nsIScriptError.warningFlag,
             "XUL JavaScript");
    
    var console = Components.classes["@mozilla.org/consoleservice;1"]
                            .getService(Components.interfaces.nsIConsoleService);
    console.logMessage(msg);
  },
      
  logError: function(message)
  {
    var msg = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
    
    msg.init("Image Browser: "+message,
             "chrome://imagebrowser/content/imagebrowser.xml",
             "",
             0,
             0,
             Components.interfaces.nsIScriptError.errorFlag,
             "XUL JavaScript");
    
    var console = Components.classes["@mozilla.org/consoleservice;1"]
                            .getService(Components.interfaces.nsIConsoleService);
    console.logMessage(msg);
  },
  
  getFolder: function()
  {
  	return mFolder;
  },
  
  getFolderEntries: function()
  {
		var mime = Components.classes["@mozilla.org/mime;1"]
		                     .getService(Components.interfaces.nsIMIMEService);
  	var files = [];
		var entries = mFolder.directoryEntries;
		while (entries.hasMoreElements())
		{
			var file = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			if (file.isDirectory())
			{
			}
			else
			{
				try
				{
					var type = mime.getTypeFromFile(file);
					if (type.substring(0,6) == "image/")
						files.push(file);
				}
				catch (e) { }
			}
		}
		files.sort(Comparators[this.comparator]);
		return files;
  },
  
  getThumbnailSize: function()
  {
  	return 100;
  },
  
  changeSortOrder: function(order)
  {
  	this.prefs.setCharPref("sortorder", order);
  },
  
  onResizeDisplay: function()
  {
  	mDisplayPanel.onResized();
  },
  
	onFolderSelect: function()
	{
		var tree = document.getElementById("folder-tree");
		var view = tree.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var fph = ios.getProtocolHandler("file")
                 .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
		mFolder = fph.getFileFromURLSpec(view.getResourceAtIndex(tree.currentIndex).Value);
		mDisplayPanel.onFolderChanged();
		document.getElementById("folder-statusbarpanel").label = mFolder.path;
	},
	
	thumbnailCallback: function(file, image, size, callback)
	{
		var canvas = document.getElementById("thumbnail-canvas");
		if (image.width > image.height)
		{
			canvas.width = size;
			canvas.height = (image.height / image.width) * size;
		}
		else
		{
			canvas.height = size;
			canvas.width = (image.width / image.height) * size;
		}
		var ctx = canvas.getContext("2d");
		ctx.save();
		ctx.scale(canvas.width/image.width, canvas.height/image.height);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
		var url = canvas.toDataURL();
		
		ProgressHandler.completeOperation(10);
		callback(url, canvas.width, canvas.height);
		
		if (this.cache)
		{
			var stmt = this.cache.createStatement("INSERT OR REPLACE INTO Thumbnail (file,size,date,uri,width,height) VALUES (?1,?2,?3,?4,?5,?6);");
			stmt.bindStringParameter(0, file.path);
			stmt.bindInt32Parameter(1, size);
			stmt.bindInt64Parameter(2, Date.now());
			stmt.bindStringParameter(3, url);
			stmt.bindInt32Parameter(4, canvas.width);
			stmt.bindInt32Parameter(5, canvas.height);
			stmt.execute();
			stmt.reset();
		}
		
		if ((this.scalings <= this.maxScalings) && (this.scaleQueue.length > 0))
		{
			var scaling = this.scaleQueue.shift();
			this.startScale(scaling.file, scaling.size, scaling.callback);
		}
		else
			this.scalings--;
	},
	
	startScale: function(file, size, callback)
	{
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
		var image = new Image();
		image.src = ios.newFileURI(file).spec;
		image.onload = function() { ImageBrowser.thumbnailCallback(file, image, size, callback); };
	},
	
	loadThumbnailForFile: function(file, size, callback)
	{
		if (this.cache)
		{
			var stmt = this.cache.createStatement("SELECT uri,width,height FROM Thumbnail WHERE file=?1 AND size=?2 AND date>?3");
			stmt.bindStringParameter(0, file.path);
			stmt.bindInt32Parameter(1, size);
			stmt.bindInt64Parameter(2, file.lastModifiedTime);
		}
		
		if (this.cache && stmt.executeStep())
		{
			var url = stmt.getString(0);
			var width = stmt.getInt32(1);
			var height = stmt.getInt32(2);
			stmt.reset();
			window.setTimeout(callback, 100, url, width, height);
			stmt = this.cache.createStatement("INSERT OR REPLACE INTO Thumbnail (file,size,date,uri,width,height) VALUES (?1,?2,?3,?4,?5,?6);");
			stmt.bindStringParameter(0, file.path);
			stmt.bindInt32Parameter(1, size);
			stmt.bindInt64Parameter(2, Date.now());
			stmt.bindStringParameter(3, url);
			stmt.bindInt32Parameter(4, width);
			stmt.bindInt32Parameter(5, height);
			stmt.execute();
			stmt.reset();
		}
		else
		{
			ProgressHandler.addOperation(10);
			if (this.scalings >= this.maxScalings)
				this.scaleQueue.push({ file: file, size: size, callback: callback });
			else
			{
				this.scalings++;
				this.startScale(file, size, callback);
			}
		}
	},
	
	toggleFolderList: function()
	{
		var tree = document.getElementById("folder-tree");
		tree.hidden = !tree.hidden;
		tree.nextSibling.hidden = tree.hidden;
		var menu = document.getElementById("folderlist-menuitem");
		menu.setAttribute("checked", tree.hidden ? "false" : "true");
		this.onResizeDisplay();
	},
	
	showAbout: function()
	{
	},
	
	showOptions: function(paneID)
	{
	  var instantApply = true;
	  var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");
	
	  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                     .getService(Components.interfaces.nsIWindowMediator);
	  var win = wm.getMostRecentWindow("imagebrowser:options");
	  if (win)
	  {
	    win.focus();
	    if (paneID)
	    {
	      var pane = win.document.getElementById(paneID);
	      win.document.documentElement.showPane(pane);
	    }
	  }
	  else
	    openDialog("chrome://imagebrowser/content/options/options.xul",
	               "Options", features, paneID);
	},
	
	changeDisplay: function(type)
	{
		if ("destroy" in mDisplayPanel)
			mDisplayPanel.destroy();

		var menu = document.getElementById("viewtypes-separator");
		menu = menu.nextSibling;
		while (menu)
		{
			menu,setAttribute("checked", (menu.id == type+"-menuitem") ? "true" : "false");
			menu = menu.nextSibling;
		}
		var display = document.getElementById("display-deck");
		mDisplayPanel = document.getElementById(type+"-panel");
		display.selectedPanel = mDisplayPanel;
		
		if ("initialise" in mDisplayPanel)
			mDisplayPanel.initialise();
		mDisplayPanel.setFolder();
	},

	observe: function (subject, topic, data)
	{
		switch (data)
		{
			case "sortorder":
				var newc = this.prefs.getCharPref(data);
				if (newc != this.comparator)
				{
					if (newc in Comparators)
					{
						document.getElementById("sort-"+this.comparator+"-menuitem").removeAttribute("checked");
						this.comparator = newc;
						document.getElementById("sort-"+this.comparator+"-menuitem").setAttribute("checked", "true");
						mDisplayPanel.onSortChanged();
					}
					else
						this.prefs.setCharPref(data, this.comparator);
				}
				break;
			case "scaling.parallels":
				this.maxScalings = this.prefs.getIntPref(data);
				while ((this.scalings < this.maxScalings) && (this.scaleQueue.length > 0))
				{
					var scaling = this.scaleQueue.shift();
					this.scalings++;
					this.startScale(scaling.file, scaling.size, scaling.callback);
				}
				break;
		}
	},
	
	handleEvent: function(event)
	{
		switch (event.type)
		{
			case "load":
				this.init();
				break;
			case "unload":
				this.destroy();
				break;
			case "resize":
				this.onResizeDisplay();
				break;
		}
	}
};

window.addEventListener("load", ImageBrowser, false);
