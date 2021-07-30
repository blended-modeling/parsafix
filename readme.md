Parsafix
======

**Welcome to the prototype implementation of Parsafix!**

Parsafix is a tool that enables real-time collaboration among engineers working on models conforming to the same DSL, but in different language workbenches.\
Parsafix does this by facilitating indirect communication between existing real-time collaboration (RTC) technologies that the language workbenches possess, posing as a client for each and translating model data from one side to the other, ultimately forming a collaborative project.

The real-time collaboration technologies that this prototype is designed to work with are plugins called [**Modelix**](https://github.com/modelix/modelix) and [**Saros**](https://github.com/saros-project/saros).
Modelix is an RTC tool for the language workbench [**JetBrains MPS**](https://www.jetbrains.com/mps/), and Saros is an RTC tool for the **Eclipse IDE** (as well as IntelliJ).\
The goal of the prototype is to allow for collaboration between model engineers working inside MPS and [**Spoofax**](https://www.spoofax.dev/) (a language workbench that can be installed as a plugin inside the Eclipse IDE), by means of these RTC tools.

The video below gives a short demonstration of cross-platform modeling between MPS and Spoofax by means of the Parsafix prototype:\
<a href="https://youtu.be/DkG8gGQ3i7k" target="_blank"><img src="http://img.youtube.com/vi/DkG8gGQ3i7k/0.jpg" alt="Parsafix Demonstration" width="240" height="180" border="10" /></a>

**This document describes the technologies used for the development of the Parsafix prototype and how to run the prototype tool.**

Inside the _docs_ directory you will find an additional document that gives a high-level explanation of the prototype implementation. Any further information can be found in the code, which is heavily commented.

*Disclaimer*
------

*The prototype implementation was written as a proof-of-concept.\
Due to time constraints, some of the parts are inefficient (if not downright hacky). It's also not entirely bug free.*

General
------

The implementation is Node.js application (implemented using version 15.14.0) and works in combination with the following technologies (and their corresponding versions):

* MPS version 2020.1.1
* Modelix as pushed to GitHub on 1 April 2021 (built with Java version 15.0.2)
* Docker Desktop version 3.3.1 running Docker Engine 20.10.5
* Eclipse version 2020-06
* Spoofax version 2.5.13
* Saros for Eclipse version 16.0.1
* OpenFire version 4.6.2

The following imported NPM modules are used inside the implementation:

* @xmpp version 0.12.0
* crypto version 1.0.1
* lodash version 4.17.19
* pretty-print-json version 1.0.3
* socket.io version 4.1.2
* net version 1.0.2
* readline version 1.3.0
* xml2js version 0.4.23
* zlib version 1.0.5

These NPM modules can be installed manually or by running the *dependencies.sh* shell script found inside the repo. Make sure you have Node.js and NPM installed first.

The prototype was implemented using *Windows 10 Home* and was run locally.

Running Parsafix
------
The following section explains how to run the Parsafix prototype.

### Configuration
The _General_ section if this README gives a list of the versions of technologies I used to test the prototype. If things do not work for you, try switching to the versions in the list if possible.\
Below is a list of how to check what versions your system currently has for each required technology (inside Windows):

* **Node.js:** run `node -v` inside the command prompt
* **MPS:** inside MPS, in the menu bar, Help -> About (for Java, inside the command prompt run `java -version` )
* **Docker:** right-click on the Docker Desktop icon in the system tray -> About Docker Desktop
* **Eclipse:** inside Eclipse, in the menu bar, Help -> About Eclipse IDE
* **Spoofax:** the download site will tell you what version you are downloading
* **Saros:** the Eclipse Marketplace/Saros website will tell you what version you are installing
* **OpenFire:** when starting the OpenFire server, the server version should appear at the top of the log tray

Some lines of code must be altered to match whatever usernames and addresses you are working with. They are listed below:
- _**modelixClient.js**_: line 88 contains the default port of the Modelix server (28101). This should be the same for you if you're using the same version of Modelix. However, if this is different for you for some reason, change it here.
- _**sarosClient.js**_: lines 14-17 contain the XMPP server properties. See the code and the "Setting up Saros" section below for more details. Change these to match your situation.
  Line 33 contains the port of the proxy server used to communicate directly with the Saros host (7785). Change it if you like.
- _**httpServer.js**_: line 58 contains the port the server listens on (38101). If you prefer a different port, change this to whatever you like.

### GenericDSL
The Parsafix prototype currently only supports a single DSL, namely an extremely simple DSL called _Generic DSL_.
Models in _Generic DSL_ look like this:

      root <root name>
         parent <parent name>
            child <child name 1>
            child <child name 2>

In addition to the Parsafix code, this repository also contains an MPS project which is the MPS language implementation for _Generic DSL_. It can be found in the _**GenericDLS**_ directory.

### Setting up Saros
How to install Saros in Eclipse can be found on the [Saros website](https://www.saros-project.org/). In addition, an XMPP server must be setup that Saros can utilize. I have done this locally using an OpenFire server. In theory every XMPP server should work, but be warned that things could be implemented slighlty differently, causing the communication between Parsafix and the XMPP server to fail.\
By default, an XMPP server listens for XMPP messages on port 5222 (`xmpp://localhost:5222`). In addition, the XMPP server is given a domain name. When installing a server, it may set the domain name to the name of your computer by default, or something like that. Within OpenFire the domain name can be customized. I chose the domain name `saroshost`.

We need an Eclipse client to serve as a host for the Saros session. This client must register as an XMPP user on the XMPP server. With OpenFire, this can be doen by naviagting to `localhost:9090` and either creating an admin account and using the corresponding admin user as Saros host, or creating a new user that you wish to use as host.\
As can be seen in the *sarosClient.js* file, I have given my Saros host the username `admin`. The password can be whatever you like.\

Parsafix is not capable of registering as an XMPP user itself, so we must do this for it manually. I did this by going to the OpenFire server at `localhost:9090` and creating a new user with username `parsafix` and password `parsafix`, which matches the configuration in the *sarosClient.js* file.

Next the Parsafix user needs to be added as a contact to the Saros host's contact list, so that the host can add Parsafix to a Saros session. I did the following to achieve this:
1. Start up the OpenFire server
2. Open Eclipse with the Saros plugin installed
3. Under the "Saros" menu, click "Add account"
4. A popup will show up. Here we fill in:\
   Under JID, the username + domain name of the host (`admin@saroshost` in my case)\
   The corresponding password\
   Under advanced options: the server address (`localhost`) and the port (`5222`)
5. Click "Finish"
6. To view the Saros plugin view within Eclipse, navigate to and click Window -> Show View -> Other... -> Saros -> Saros. The Saros view should appear somewhere.
7. It's possible that the Saros plugin connected to the OpenFire server automatically after adding the host account. If not, inside the Saros view, find and click the dropdown icon next to the "connect" button (tiny icon of a blue plug). Select the host account you just added. This will connect to the OpenFire server. You can tell that you are connected if the dark grey bar in the Saros view lists the host's username followed by "(connected)".
8. In the Saros view, right-click "Contacts" and click "Add contact".
9. A popup will show up. Here we fill in:\
   The username + domain name of the Parsafix user you created (`parsafix@saroshost` in my case)\
   A nickname for Parsafix if you like. I left this field blank.
10. Click "Finish". 

Parsafix has now been invited as a contact by the host. All that is left to do, is for Parsafix to accept this invitation. It cannot do this by itself, so we must do it manually. To achieve this, I did the following:
1. Under the "Saros" menu, click "Add account"
2. Inside the popup that shows up we fill in:\
   Under JID, the username + domain name of the Parsafix user (`parsafix@saroshost` in my case)\
   The corresponding password (`parsafix`)\
   Under advanced options: the server address (`localhost`) and the port (`5222`)
3. Next, inside the Saros view, we disconnect the host, select the Parsafix user instead and connect as the Parsafix user (if this did not happen automatically already)
4. Upon connecting, a popup will appear that tells us the Parsafix user has been invited by the host user to become a contact. We accept the invitation.
5. We can now disconnect as the Parsafix user and reconnect as the host user. We don't need to connect as the Parsafix user via Eclipse ever again.

### Setting up Modelix
How to install the Modelix server and the Modelix plugin inside of MPS can be found on the [Modelix Github page](https://github.com/modelix/modelix). Getting the Modelix server to run proved quite a challenge, so don't be disheartened if you run into some problems here. In the _docs_ directory of this repository I have added a file named _**Running Modelix locally**_ that explains how I eventually managed to get the Modelix server running.

### Starting Parsafix
Once everything is installed, follow the steps below to start up Parsafix.\
These steps should be followed every time you wish to start up Parsafix from scratch. The above installations only need to be performed once.

1. Start up Docker Desktop (if it is not already running)
2. Start up the OpenFire server (if it is not already running)
3. Start up the Modelix server (model server + database)
4. Open MPS and open the MPS project inside the Modelix directory (from the repository on the Modelix Github page)
5. Inside MPS, do the following if you have not already done so during the Modelix installation (MPS should remember the repository after this step has been performed once):\
   a. Inside the "Cloud" tab view, right-click the yellow C icon and click "Add repository".\
   b. A popup will appear, where we fill in the address of our local Modelix server (`localhost:28101`)\
   c. The "Cloud" tab should indicate that it is connected to the server\
6. Inside MPS, leaving the Modelix project open, open the MPS project that contains the GenericDSL implementation.
7. Inside the GenericDSL project, go down to the "Cloud" tab, expand the repository and under "data [master]" right-click "ROOT #1" and click "Add Module".
8. A popup will appear. Name the module whatever you like. I usually go with `TestModule`.
9. Right-click the new Module and click "Add Model". Name it anything. I usually go with `TestModel`.
10. Right-click the module and click "Bind to Transient Module".
11. In MPS's project view a "Cloud" option should now appear. Click the dropdown icon next to it and right-click the model. Click the Model Properties option.
12. Inside the popup, go to the "Used Languages" tab. Click the + sign on the right and add GenericDSL. Click "Apply" and close the popup.
13. Inside Eclipse, connect to Saros as the host user. In the Saros view, right-click "No Session Running" and click "Share Project(s)". Select a (preferably empty) project and click "Finish".
14. Inside a terminal in the Parsafix root directory, run the following command: `node index.js mps spoofax`. This starts up Parsafix.
15. Inside Eclipse, the Parsafix contact should have come online. Richt-click it and select "Add to Saros Session".

Add this point you can start adding GenericDSL "roots" within MPS, which should generate new ".dsl" files in Eclipse.
_NOTE: Spoofax does not currently have a GenericDSL implementation. It is just an example language. The .dsl files should be opened with the default Eclipse text editor._

The steps from this section are demonstrated in the video below:\
<a href="https://youtu.be/u8EVZiD6XVY" target="_blank"><img src="http://img.youtube.com/vi/u8EVZiD6XVY/0.jpg" alt="Running Parsafix" width="240" height="180" border="10" /></a>

If you decide to stop Parsafix inside the terminal and want to start it up again (while leaving everything else running), you only need to perform steps 14 and 15 again.

_NOTE: every time Parsafix is stopped and started up again, the MPS and Saros projects should not contain any models. Working with existing models is currently only partially supported and will likely cause Parsafix to crash._
