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

var ImageBrowser = {
	prefs: null,
	
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
		
		if ("initialise" in mDisplayPanel)
			mDisplayPanel.initialise();
		mDisplayPanel.setFolder(mFolder);

		this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
	                        .getService(Components.interfaces.nsIPrefService)
	                        .getBranch("imagebrowser.").QueryInterface(Components.interfaces.nsIPrefBranch2);
	
		this.maxScalings = this.prefs.getIntPref("scaling.parallel");
	
	  this.prefs.addObserver("",this,false);
	  window.addEventListener("unload", this, false);
	  window.removeEventListener("load", this, false);
	},
	
	destroy: function(event)
	{
	  window.removeEventListener("unload", this, false);
	  this.prefs.removeObserver("",this);
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
          
	onFolderSelect: function()
	{
		var tree = document.getElementById("folder-tree");
		var view = tree.view.QueryInterface(Components.interfaces.nsIXULTreeBuilder);
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var fph = ios.getProtocolHandler("file")
                 .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
		mFolder = fph.getFileFromURLSpec(view.getResourceAtIndex(tree.currentIndex).Value);
		mDisplayPanel.setFolder(mFolder);
	},
	
	thumbnailCallback: function(image, callback)
	{
		var canvas = document.getElementById("thumbnail-canvas");
		if (image.width > image.height)
		{
			canvas.width = 100;
			canvas.height = (image.height / image.width) * 100;
		}
		else
		{
			canvas.height = 100;
			canvas.width = (image.width / image.height) * 100;
		}
		var ctx = canvas.getContext("2d");
		ctx.save();
		ctx.scale(canvas.width/image.width, canvas.height/image.height);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
		var url = canvas.toDataURL();
		callback(url, canvas.width, canvas.height);
		if ((this.scalings <= this.maxScalings) && (this.scaleQueue.length > 0))
		{
			var scaling = this.scaleQueue.shift();
			this.startScale(scaling.uri, scaling.callback);
		}
		else
			this.scalings--;
	},
	
	startScale: function(uri, callback)
	{
		var image = new Image();
		image.src = uri;
		image.onload = function() { ImageBrowser.thumbnailCallback(image, callback); };
	},
	
	loadThumbnailForURI: function(uri, callback)
	{
		if (this.scalings >= this.maxScalings)
			this.scaleQueue.push({ uri: uri, callback: callback });
		else
		{
			this.scalings++;
			this.startScale(uri, callback);
		}
	},
	
	toggleFolderList: function()
	{
		var tree = document.getElementById("folder-tree");
		tree.hidden = !tree.hidden;
		tree.nextSibling.hidden = tree.hidden;
		var menu = document.getElementById("folderlist-menuitem");
		menu.setAttribute("checked", tree.hidden ? "false" : "true");
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
		mDisplayPanel.setFolder(mFolder);
	},

	observe: function (subject, topic, data)
	{
		switch (data)
		{
			case "scaling.parallels":
				this.maxScalings = this.prefs.getIntPref(data);
				while ((this.scalings < this.maxScalings) && (this.scaleQueue.length > 0))
				{
					var scaling = this.scaleQueue.shift();
					this.scalings++;
					this.startScale(scaling.uri, scaling.callback);
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
		}
	},
};

window.addEventListener("load", ImageBrowser, false);
