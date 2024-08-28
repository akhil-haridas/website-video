const regexURL = /(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const regexURLWithHttp = /^(http(s)?:\/\/.){1}/gi;

export const setHTTPForURL = (url) => {
    if (regexURLWithHttp.test(url)) return url;
    return `https://${url}`;
};

export const isValidURL = (url) => {
    if (url.startsWith("file:/")) return false;
    return regexURL.test(url);
};

export const onSubmit = async (url, customHeaders = {}, setLoading, setFetchError) => {
    setLoading(true);
    setFetchError("");

    try {
        // first fetch for the proxied url
        const proxyUrlRes = await fetch(`${PATH}/pdftron-proxy?url=${url}`, {
            credentials: "include",
            headers: customHeaders,
        });
        if (proxyUrlRes.status === 400) {
            setFetchError((await proxyUrlRes.json()).errorMessage);
            setLoading(false);
        } else {
            const proxyUrlResJson = await proxyUrlRes.json();
            let validUrl = url;
            try {
                // retrieve validUrl from response
                validUrl = proxyUrlResJson.validUrl;
                setValidUrl(validUrl);
            } catch {
                console.error("Error in calling `/pdftron-proxy`. Check server log");
            }
            const { href, origin, pathname } = new URL(validUrl);
            const hrefWithoutOrigin = href.split(origin)[1] || pathname;

            // send back defaultPageDimensions so iframeHeight can be updated dynamically from script injection
            setResponse({
                iframeUrl: `${PATH}${hrefWithoutOrigin}`,
                ...defaultPageDimensions,
                urlToProxy: validUrl,
            });
            setLoading(false);
        }
    } catch (error) {
        console.error(error);
        setLoading(false);
        setFetchError(
            "Trouble fetching the URL, please make sure the server is running. `cd server && npm start`"
        );
    }
};

export const loadDocAndAnnots = async (blob, pageDimensions, setLoading) => {
    setLoading(true);
    const doc = await instance.Core.createDocument(blob, {
        extension: "png",
        pageSizes: [pageDimensions],
    });

    const xfdf = await instance.Core.documentViewer
        .getAnnotationManager()
        .exportAnnotations();
    const data = await doc.getFileData({ xfdfString: xfdf });
    const annotationsBlob = new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(annotationsBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotated";
    a.click();
    a.remove();
    setLoading(false);
    // in case the Blob uses a lot of memory
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export const downloadPDF = async (validUrl, response, setLoading, setFetchError) => {
    if (validUrl && response.iframeUrl) {
        setLoading(true);
        setFetchError("");
        try {
            const downloadPdfRes = await fetch(
                `${PATH}/pdftron-download?url=${validUrl}`
            );
            if (downloadPdfRes.ok) {
                try {
                    // if sending only buffer from the server: res.send(buffer) then use res.blob() to avoid having the API consumed twice
                    const downloadPdfResJson = await downloadPdfRes.json();
                    const { buffer, pageDimensions } = downloadPdfResJson;

                    const blob = new Blob([new Uint8Array(buffer.data)]);
                    await loadDocAndAnnots(blob, pageDimensions, setLoading);
                } catch (error) {
                    console.error(error);
                    setFetchError(
                        "Trouble downloading, please refresh and start again."
                    );
                }
            } else {
                setFetchError("Trouble downloading, check server log.");
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            setFetchError(
                "Trouble downloading, please make sure the server is running. `cd server && npm start`"
            );
            setLoading(false);
        }
    } else {
        setFetchError("Please enter a valid URL and try again.");
    }
};

export const browseMode = () => {
    instance && instance.UI.setToolbarGroup("toolbarGroup-View");
};
