declare module 'ytsr' {
    interface SearchResult {
        query: string;
        items: SearchResultItem[];
        nextPageRef: string;
    }

    interface SearchResultItem {
        link: string;
        title: string;
        duration: string;
        thumbnail: string;
        [key: string]: any;
    }

    function ytsr(
        searchString: string,
        options?: { safeSearch?: boolean; limit?: number; nextPageRef?: string },
    ): Promise<SearchResult>;

    export = ytsr;
}
