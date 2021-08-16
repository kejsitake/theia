/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { BreadcrumbsContribution } from '@theia/core/lib/browser/breadcrumbs/breadcrumbs-contribution';
import { Breadcrumb } from '@theia/core/lib/browser/breadcrumbs/breadcrumb';
import { FilepathBreadcrumb } from './filepath-breadcrumb';
import { injectable, inject } from '@theia/core/shared/inversify';
import { LabelProvider, Widget } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { BreadcrumbsFileTreeWidget } from './filepath-breadcrumbs-container';
import { DirNode } from '../file-tree';
import { Disposable } from '@theia/core';
import { FileService } from '../file-service';
import { FileStat } from '../../common/files';

export const FilepathBreadcrumbType = Symbol('FilepathBreadcrumb');

@injectable()
export class FilepathBreadcrumbsContribution implements BreadcrumbsContribution {

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(FileService)
    protected readonly fileSystem: FileService;

    @inject(BreadcrumbsFileTreeWidget)
    protected readonly breadcrumbsFileTreeWidget: BreadcrumbsFileTreeWidget;

    readonly type = FilepathBreadcrumbType;
    readonly priority: number = 100;

    async computeBreadcrumbs(uri: URI): Promise<Breadcrumb[]> {
        if (uri.scheme !== 'file') {
            return [];
        }
        return uri.allLocations
            .map((location, index) => new FilepathBreadcrumb(
                location,
                this.labelProvider.getName(location),
                this.labelProvider.getLongName(location),
                index === 0 ? this.labelProvider.getIcon(location) + ' file-icon' : ''
            ))
            .filter(b => this.filterBreadcrumbs(uri, b))
            .reverse();
    }

    protected filterBreadcrumbs(_: URI, breadcrumb: FilepathBreadcrumb): boolean {
        return !breadcrumb.uri.path.isRoot;
    }

    async attachPopupContent(breadcrumb: Breadcrumb, parent: HTMLElement): Promise<Disposable | undefined> {
        if (!FilepathBreadcrumb.is(breadcrumb)) {
            return undefined;
        }
        const folderFileStat = await this.fileSystem.resolve(breadcrumb.uri.parent);
        if (folderFileStat) {
            const rootNode = await this.createRootNode(folderFileStat);
            await this.breadcrumbsFileTreeWidget.model.navigateTo(rootNode);
            Widget.attach(this.breadcrumbsFileTreeWidget, parent);
            return {
                dispose: () => {
                    // Clear model otherwise the next time a popup is opened the old model is rendered first
                    // and is shown for a short time period.
                    this.breadcrumbsFileTreeWidget.model.root = undefined;
                    Widget.detach(this.breadcrumbsFileTreeWidget);
                }
            };
        }
    }

    protected async createRootNode(folderToOpen: FileStat): Promise<DirNode | undefined> {
        const folderUri = folderToOpen.resource;
        const rootUri = folderToOpen.isDirectory ? folderUri : folderUri.parent;
        const rootStat = await this.fileSystem.resolve(rootUri);
        if (rootStat) {
            return DirNode.createRoot(rootStat);
        }
    }
}
