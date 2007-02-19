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
 * $HeadURL: svn://svn.blueprintit.co.uk/dave/mozilla/firefox/FindBar/trunk/src/chrome/content/binding.js $
 * $LastChangedBy: dave $
 * $Date: 2007-01-22 18:05:13 +0000 (Mon, 22 Jan 2007) $
 * $Revision: 904 $
 *
 */

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
	init: function(event)
	{
		var display = document.getElementById("display-deck");
		var panel = display.selectedPanel;
		var type = panel.id.substring(0, panel.id.length-6);
		var menu = document.getElementById(type+"-menuitem");
		menu.setAttribute("checked", "true");

		var tree = document.getElementById("folder-tree");
		menu = document.getElementById("folderlist-menuitem");
		menu.setAttribute("checked", tree.hidden ? "false" : "true");
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
		alert('about');
	},
	
	showOptions: function()
	{
		alert('options');
	},
	
	changeDisplay: function(type)
	{
		var menu = document.getElementById("viewtypes-separator");
		menu = menu.nextSibling;
		while (menu)
		{
			menu,setAttribute("checked", (menu.id == type+"-menuitem") ? "true" : "false");
			menu = menu.nextSibling;
		}
		var display = document.getElementById("display-deck");
		var panel = document.getElementById(type+"-panel");
		display.selectedPanel = panel;
	}
};

window.addEventListener("load", ImageBrowser.init, false);
