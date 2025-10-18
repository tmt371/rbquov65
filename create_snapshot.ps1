# 輸出檔案的名稱
$outputFile = "codebase_snapshot.txt"
# 清空舊檔案
Clear-Content $outputFile

# 定義要包含的檔案/資料夾列表 (基於您的 8 批次清單)
$includePaths = @(
    ".gitignore",
    ".gitattributes",
    "package.json",
    "package-lock.json",
    "index.html",
    "style.css",
    "jest.config.js",
    "babel.config.js",
    ".eslintrc.json",
    ".prettierrc.json",
    "03-data-models",
    "04-core-code"
)

# 遍歷所有指定的路徑
Get-ChildItem -Path $includePaths -Recurse | Where-Object { !$_.PSIsContainer } | ForEach-Object {
    # 取得相對路徑
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    # 將路徑中的 '\' 轉換為 '/'
    $normalizedPath = $relativePath.Replace("\", "/")

    # 寫入檔案標頭
    Add-Content -Path $outputFile -Value "--- FILE START: $normalizedPath ---"
    # 寫入檔案內容
    Add-Content -Path $outputFile -Value (Get-Content $_.FullName -Raw)
    # 寫入檔案結尾
    Add-Content -Path $outputFile -Value "--- FILE END ---`n"
}

Write-Host "Codebase snapshot created: $outputFile"