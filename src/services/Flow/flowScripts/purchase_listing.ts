export const purchase_listing = () => {`
import FungibleToken from 0x9a0766d93b6608b7
import FlowToken from 0x7e60df042a9c0868
import NonFungibleToken from 0x631e88ae7f1d7c20
import NFTStorefrontV2 from 0x2d55b98eb200daef
import Engage from 0x1ad3c2a8a0bca093

pub fun getOrCreateCollection(account: AuthAccount): &Engage.Collection{NonFungibleToken.Receiver} {
    if let collectionRef = account.borrow<&Engage.Collection>(from: Engage.CollectionStoragePath) {
        return collectionRef
    }

    // create a new empty collection
    let collection <- Engage.createEmptyCollection() as! @Engage.Collection

    let collectionRef = &collection as &Engage.Collection

    // save it to the account
    account.save(<-collection, to: Engage.CollectionStoragePath)

    // create a public capability for the collection
    account.link<&Engage.Collection{NonFungibleToken.CollectionPublic}>(Engage.CollectionPublicPath, target: Engage.CollectionStoragePath)

    return collectionRef
}

transaction(listingResourceID: UInt64, storefrontAddress: Address) {
    let paymentVault: @FungibleToken.Vault
    let EngageCollection: &Engage.Collection{NonFungibleToken.Receiver}
    let storefront: &NFTStorefrontV2.Storefront{NFTStorefrontV2.StorefrontPublic}
    let listing: &NFTStorefrontV2.Listing{NFTStorefrontV2.ListingPublic}

    prepare(account: AuthAccount) {
        // Access the storefront public resource of the seller to purchase the listing.
        self.storefront = getAccount(storefrontAddress)
            .getCapability<&NFTStorefrontV2.Storefront{NFTStorefrontV2.StorefrontPublic}>(
                NFTStorefrontV2.StorefrontPublicPath
            )!
            .borrow()
            ?? panic("Could not borrow Storefront from provided address")

        // Borrow the listing
        self.listing = self.storefront.borrowListing(listingResourceID: listingResourceID)
                    ?? panic("No Offer with that ID in Storefront")
        let price = self.listing.getDetails().salePrice

        // Access the vault of the buyer to pay the sale price of the listing.
        let mainFlowVault = account.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Cannot borrow FlowToken vault from account storage")
        self.paymentVault <- mainFlowVault.withdraw(amount: price)

        self.EngageCollection = getOrCreateCollection(account: account)
    }

    execute {
        let item <- self.listing.purchase(
            payment: <-self.paymentVault,
            commissionRecipient: nil
        )

        self.EngageCollection.deposit(token: <-item)
        self.storefront.cleanupPurchasedListings(listingResourceID: listingResourceID)
    }
}
`
}