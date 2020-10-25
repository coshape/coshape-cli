# Coshape CLI Tool

An experimental toolkit to create web based 3D designs, convert and visualize CAD data and access the coshape CAD web services for Maker projects.
Checkout [coshape.io](https://coshape.io) for the tutorials and examples.

## Features
- create customizable 3D modeling frontends
- define assemblies of parametrized 3D models in [YAML](http://yaml.org/) based project file
- integrated SCAD (OpenJscad), STL and SVG for 3D printers and Laser cutters
- create and manage customizable projects
- live server and static build

## Global Installation

Install the toolkit globally for easy access. Note that this will usually require root permission (sudo).

``` bash
$ npm install coshape -g
```

The toolkit is now available in the terminal as coshape command.
``` bash
$ coshape
```

## Local Installation

Of course, the toolkit can also be installed with root permissions.

To install the toolkit locally, create a new directory e.g. 'coshape-tools' and run npm.

``` bash
$ npm install coshape
```

Access the toolkit from the current working directory like this.
``` bash
$ ./node_modules/coshape/bin/coshape.js
```

## Source Code

The source code is on [GitHub](https://github.com/coshape/coshape-cli) and can be checked out like this.

``` bash
$ git clone https://github.com/coshape/coshape-cli.git/
```

Change into the project directory, install the dependencies with npm and the toolkit is ready to be used.

``` bash
$ npm install
```

Access the toolkit from the current working directory like this.
``` bash
$ ./node_modules/coshape/bin/coshape.js
```

## Quick Start

**Create a new project**

Creates a new project folder and fills it with a dummy customizer for testing. 

``` bash
$ coshape new my-awesome-project
$ cd my-awesome-project
```


**test your projects in a live server**
Change into customizer project folder or into a workspace and start the live server. Open a browser and go to the following url.
```
http://localhost:3000
```

Edit the customizer source code files and the server will automatically update the web application and reload the browser window.

``` bash
$ coshape run
```

**Generate static files**

``` bash
$ coshape build
```

**Create a new workspace to manage several projects**

Create a new directory for your customizer projects. Change into the new directory and initialize the workspace.

``` bash
$ coshape init
```

**Have fun!**

![screenshot]( doc/screenshot_table.png?raw=true )


## License

MIT
