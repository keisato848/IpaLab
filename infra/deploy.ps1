$location = "japaneast"
$deploymentName = "ipalab-deployment-" + (Get-Date -Format "yyyyMMdd-HHmm")

Write-Host "Starting Azure Deployment..."
Write-Host "Location: $location"

# Check if logged in
$account = az account show
if ($null -eq $account) {
    Write-Host "Please login to Azure first using 'az login'"
    exit 1
}

# Run Deployment
az deployment sub create `
  --name $deploymentName `
  --location $location `
  --template-file ./azure/main.bicep `
  --parameters location=$location

Write-Host "Deployment initiated. Check Azure Portal for status."
