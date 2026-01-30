import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FileNode } from '../../core/types/file-node.type';
import { DEFAULT_IGNORED_FOLDERS } from '../../core/constants/ignore-folders';


@Injectable()
export class LocalScannerService{

    private scanDirectory(dirPath:string):FileNode{
        const node:FileNode={
            path:path.normalize(dirPath),
            type:'folder',
            children:[],
        };
        const items =fs.readdirSync(dirPath);

        for(const item of items){
            if(DEFAULT_IGNORED_FOLDERS.includes(item))continue;

            const fullPath=path.join(dirPath,item);
            const stats=fs.statSync(fullPath);

            if(stats.isDirectory()){
                node.children!.push(this.scanDirectory(fullPath));
            }else{
                node.children!.push({
                    path:path.normalize(fullPath),
                    type:'file',
                });
            }
        }
        return node;
    }


    scan(rootPath:string):FileNode{
        const stats=fs.statSync(rootPath);

        if(!stats.isDirectory()){
            throw new Error('Provided Path is not Directory');
        }
        return this.scanDirectory(rootPath);
    }
    

    
}