const IPFS = require('ipfs-core')
const fsPromises = require('fs').promises;
const path = require('path');

let IpfsInterface = function() {
    this.ipfs = null
}

IpfsInterface.prototype.init = async function() {
    if (!this.ipfs) {
        this.ipfs = await IPFS.create()
        // clear directory
        // await this.ipfs.files.rm('/', { recursive: true })
        const res = await this.ipfs.files.ls('/')
        for await(const item of res) {
            await this.ipfs.files.rm('/' + item.name, { recursive: true })
        }
    }
}

IpfsInterface.prototype.save = async function(file_path, relative_path) {
    // make use of the mutable file system extension of ipfs
    // cf. https://docs.ipfs.io/concepts/file-systems/#mutable-file-system-mfs

    await this.init();
    const stats = await fsPromises.stat(file_path)
    const top_level = !relative_path;

    relative_path = relative_path || '/'
    if (stats.isDirectory()) {
        const dir_name = path.basename(file_path)
        const dir_path = path.join(relative_path, dir_name)
        await this.ipfs.files.mkdir(dir_path, {parents:true})

        const items = await fsPromises.readdir(file_path)
        for (var it of items) {
            await this.save(path.join(file_path, it), dir_path)
        }
    } else {
        const content = await fsPromises.readFile(file_path)
        const file_name = path.basename(file_path)
        const local_path = path.join(relative_path, file_name)
        console.log(local_path)
        await this.ipfs.files.write(local_path, content, {create: true})
    }

    if (top_level) {
        const res = await this.ipfs.files.stat('/')
        return res.cid
    } else {
        return null;
    }
}

IpfsInterface.prototype.load = async function(ipfs_path, dest_path) {
    await this.init();
    const stat = await this.ipfs.files.stat(ipfs_path)
    if (stat.type == 'directory') {
        const dir_path = path.resolve( dest_path )
        // console.log('mkdir', dir_path)
        await fsPromises.mkdir( path.resolve(dir_path), {recursive: true} )
        const res = await this.ipfs.files.ls(ipfs_path)
        for await(const item of res) {
            await this.load(item.cid, path.join(dest_path, item.name))
        }
    } else {
        let stream = await this.ipfs.files.read(ipfs_path)
        const file_path = path.resolve(dest_path)

        let data = '';
        for await (const chunk of stream) {
          data += chunk
        }
        console.log('clone', file_path)
        await fsPromises.writeFile(path.resolve(file_path), data)
    }
}
IpfsInterface.prototype.close = async function() {
    console.log('close ipfs connection')
}

module.exports.IpfsInterface = IpfsInterface;
